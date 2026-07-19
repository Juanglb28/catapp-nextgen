import { and, asc, eq, gte, lt, notExists, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointments } from "@/modules/appointments/schema";
import { clients } from "@/modules/clients/schema";
import { tenants } from "@/modules/tenancy/schema";

import {
  type WaMessage,
  type WaMessageStatus,
  messageTemplates,
  waMessages,
} from "./schema";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  type TemplateKey,
} from "./templates";

/**
 * Repositorio de plantillas — alcance de tenant obligatorio (D-11).
 */

/**
 * Texto de cada plantilla del tenant, combinando los textos por defecto con los
 * overrides guardados. Siempre devuelve las 4 keys.
 */
export async function getTemplates(
  tenantId: string,
): Promise<Record<TemplateKey, string>> {
  const rows = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.tenantId, tenantId));
  const overrides = new Map(rows.map((r) => [r.key, r.text]));

  const result = {} as Record<TemplateKey, string>;
  for (const key of TEMPLATE_KEYS) {
    result[key] = overrides.get(key) ?? DEFAULT_TEMPLATES[key];
  }
  return result;
}

/** Inserta o actualiza el texto de una plantilla del tenant. */
export async function upsertTemplate(
  tenantId: string,
  key: TemplateKey,
  text: string,
): Promise<void> {
  await db
    .insert(messageTemplates)
    .values({ tenantId, key, text })
    .onConflictDoUpdate({
      target: [messageTemplates.tenantId, messageTemplates.key],
      set: { text, updatedAt: new Date() },
    });
}

/* ---------------------------------------------------------------------------
 * Mensajes de WhatsApp Cloud API (F8.B1). El acceso a `db` vive aquí (D-11);
 * `messages.ts` solo re-exporta para el resto del módulo.
 * ------------------------------------------------------------------------- */

const STATUS_RANK: Record<WaMessageStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 99,
};

export async function queueMessage(
  tenantId: string,
  data: {
    appointmentId?: string | null;
    toPhone: string;
    templateName: string;
  },
): Promise<string> {
  const [row] = await db
    .insert(waMessages)
    .values({
      tenantId,
      appointmentId: data.appointmentId ?? null,
      toPhone: data.toPhone,
      templateName: data.templateName,
      status: "queued",
    })
    .returning({ id: waMessages.id });
  return row.id;
}

export async function markSent(id: string, waMessageId: string): Promise<void> {
  await db
    .update(waMessages)
    .set({ status: "sent", waMessageId, updatedAt: new Date() })
    .where(eq(waMessages.id, id));
}

export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(waMessages)
    .set({ status: "failed", error, updatedAt: new Date() })
    .where(eq(waMessages.id, id));
}

/**
 * Actualiza el estado por `wa_message_id` (webhook). No retrocede de estado;
 * `failed` siempre se aplica.
 */
export async function updateStatusByWaId(
  waMessageId: string,
  status: WaMessageStatus,
  error: string | null = null,
): Promise<void> {
  const [current] = await db
    .select({ id: waMessages.id, status: waMessages.status })
    .from(waMessages)
    .where(eq(waMessages.waMessageId, waMessageId))
    .limit(1);
  if (!current) return;
  if (status !== "failed" && STATUS_RANK[status] <= STATUS_RANK[current.status])
    return;

  await db
    .update(waMessages)
    .set({
      status,
      ...(status === "failed" ? { error } : {}),
      updatedAt: new Date(),
    })
    .where(eq(waMessages.id, current.id));
}

/** ¿Ya existe un mensaje de esta plantilla para esta cita? (idempotencia, F8.B2) */
export async function hasMessage(
  tenantId: string,
  appointmentId: string,
  templateName: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: waMessages.id })
    .from(waMessages)
    .where(
      and(
        eq(waMessages.tenantId, tenantId),
        eq(waMessages.appointmentId, appointmentId),
        eq(waMessages.templateName, templateName),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Mensajes de WhatsApp de una cita (para mostrar el estado en el detalle). */
export async function listAppointmentMessages(
  tenantId: string,
  appointmentId: string,
): Promise<WaMessage[]> {
  return db
    .select()
    .from(waMessages)
    .where(
      and(
        eq(waMessages.tenantId, tenantId),
        eq(waMessages.appointmentId, appointmentId),
      ),
    )
    .orderBy(asc(waMessages.createdAt));
}

export type DueReminder = {
  appointmentId: string;
  tenantId: string;
  startsAt: Date;
  publicToken: string;
  clientName: string;
  toPhone: string;
  timezone: string;
};

/**
 * Citas agendadas en la ventana `[fromUtc, toUtc)` que deben recibir el
 * recordatorio: el tenant tiene los mensajes automáticos activos, la clienta no
 * está en opt-out y NO existe ya un `wa_messages` de esa plantilla para la cita
 * (idempotencia). Consulta de SISTEMA (cron): es cross-tenant a propósito; no
 * recibe `tenantId` porque el cron procesa todos los negocios a la vez.
 */
export async function listDueReminders(
  fromUtc: Date,
  toUtc: Date,
  templateName: string,
): Promise<DueReminder[]> {
  return db
    .select({
      appointmentId: appointments.id,
      tenantId: appointments.tenantId,
      startsAt: appointments.startsAt,
      publicToken: appointments.publicToken,
      clientName: clients.name,
      toPhone: clients.phone,
      timezone: tenants.timezone,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(tenants, eq(tenants.id, appointments.tenantId))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        gte(appointments.startsAt, fromUtc),
        lt(appointments.startsAt, toUtc),
        eq(tenants.autoMessages, true),
        eq(clients.waOptOut, false),
        notExists(
          db
            .select({ x: sql`1` })
            .from(waMessages)
            .where(
              and(
                eq(waMessages.appointmentId, appointments.id),
                eq(waMessages.templateName, templateName),
              ),
            ),
        ),
      ),
    );
}
