"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getPgError } from "@/lib/pg-error";
import { normalizePhone } from "@/lib/phone";
import { swallow } from "@/lib/swallow";
import {
  fetchGoogleContacts,
  getAccessTokenForSettings,
  getCalendarAccess,
  upsertBirthdayCalendarEvent,
} from "@/modules/calendar/google";
import { requireTenant } from "@/modules/tenancy/context";

import { sendBirthdayPushToTenant } from "@/modules/birthdays/push";
import { upsertBirthdayBonus } from "@/modules/birthdays/repository";
import {
  archiveClient,
  createClient,
  deleteClient,
  type ClientInput,
  listClientsWithoutBirthday,
  restoreClient,
  setClientBirthdayGcalEventId,
  setClientOptOut,
  updateClient,
  updateClientBirthday,
} from "./repository";
import { clientFormSchema } from "./validation";

/** Detecta una violación de unique constraint de PostgreSQL (código 23505). */
function isDuplicatePhone(error: unknown): boolean {
  const pg = getPgError(error);
  return pg?.code === "23505" && (pg.constraint?.includes("phone") ?? false);
}

/** Entrada mínima para importar un contacto de Google. */
export type ContactImportInput = {
  name: string;
  /** Teléfono ya normalizado a E.164 (+57XXXXXXXXXX, o de otro país). */
  phone: string;
  email: string;
  /** Fecha de cumpleaños "YYYY-MM-DD" extraída de Google Contacts (opcional). */
  birthdayDate?: string;
};

/** Normaliza el formulario validado a la forma que persiste el repositorio. */
function toClientInput(data: {
  name: string;
  phone: string;
  email: string;
  notes: string;
  birthdayDate: string;
}): ClientInput {
  return {
    name: data.name,
    // El schema ya garantizó que normalizePhone no es null.
    phone: normalizePhone(data.phone)!,
    email: data.email === "" ? null : data.email,
    notes: data.notes === "" ? null : data.notes,
    birthdayDate: data.birthdayDate === "" ? null : data.birthdayDate,
  };
}

function firstError(input: unknown) {
  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

/** Activa/desactiva el opt-out de mensajes automáticos de la clienta (F8.B2). */
export async function setClientOptOutAction(
  id: string,
  optOut: boolean,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const updated = await setClientOptOut(tenantId, id, optOut);
  if (!updated) return { ok: false, error: "No se encontró la clienta." };
  revalidatePath(`/clientas/${id}`);
  return { ok: true, data: undefined };
}

export async function createClientAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { tenantId } = await requireTenant();
  const parsed = firstError(input);
  if (!parsed.ok) return parsed;

  try {
    const client = await createClient(tenantId, toClientInput(parsed.data));
    revalidatePath("/clientas");
    return { ok: true, data: { id: client.id } };
  } catch (e) {
    if (isDuplicatePhone(e)) {
      return { ok: false, error: "Ya existe una clienta con ese teléfono." };
    }
    throw e;
  }
}

export async function updateClientAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { tenantId } = await requireTenant();
  const parsed = firstError(input);
  if (!parsed.ok) return parsed;

  let client: Awaited<ReturnType<typeof updateClient>>;
  try {
    client = await updateClient(tenantId, id, toClientInput(parsed.data));
  } catch (e) {
    if (isDuplicatePhone(e)) {
      return { ok: false, error: "Ya existe una clienta con ese teléfono." };
    }
    throw e;
  }
  if (!client) return { ok: false, error: "No se encontró la clienta." };

  // Sincronizar cumpleaños a Google Calendar si hay fecha y conexión activa.
  if (client.birthdayDate) {
    try {
      const access = await getCalendarAccess(tenantId);
      if (access) {
        const gcalId = await upsertBirthdayCalendarEvent(
          access.accessToken,
          access.calendarId,
          client.name,
          client.birthdayDate,
          client.birthdayGcalEventId,
        );
        if (!client.birthdayGcalEventId) {
          await setClientBirthdayGcalEventId(tenantId, id, gcalId);
        }
      }
    } catch (err) {
      // No bloquear la actualización por un fallo de Google Calendar.
      swallow(err, {
        module: "clients",
        op: "updateClient.gcalBirthday",
        tenantId,
      });
    }
  }

  revalidatePath("/clientas");
  revalidatePath(`/clientas/${id}`);
  return { ok: true, data: { id: client.id } };
}

export async function archiveClientAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const { tenantId } = await requireTenant();
  const client = await archiveClient(tenantId, id);
  if (!client) return { ok: false, error: "No se encontró la clienta." };

  revalidatePath("/clientas");
  revalidatePath(`/clientas/${id}`);
  return { ok: true, data: undefined };
}

export async function restoreClientAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const { tenantId } = await requireTenant();
  const client = await restoreClient(tenantId, id);
  if (!client) return { ok: false, error: "No se encontró la clienta." };

  revalidatePath("/clientas");
  revalidatePath(`/clientas/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Importa en lote contactos de Google.
 * Recibe solo los contactos seleccionados (ya con teléfono normalizado).
 * Los duplicados (constraint de phone único por tenant) se omiten en silencio.
 */

const importContactsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(1).max(20),
      email: z.string().max(200),
      birthdayDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .max(500);

export async function importContactsAction(
  contacts: ContactImportInput[],
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const { tenantId } = await requireTenant();

  const parsed = importContactsSchema.safeParse(contacts);
  if (!parsed.success) {
    return { ok: false, error: "Lista de contactos inválida." };
  }
  const validContacts = parsed.data;

  // Fecha de hoy en zona horaria del tenant (America/Bogota).
  const todayBogota = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  const todayYear = parseInt(todayBogota.slice(0, 4), 10);

  let imported = 0;
  let skipped = 0;

  for (const c of validContacts) {
    try {
      const client = await createClient(tenantId, {
        name: c.name,
        phone: c.phone,
        email: c.email === "" ? null : c.email,
        notes: null,
        birthdayDate: c.birthdayDate ?? null,
      });
      imported++;

      // Si cumple años hoy, disparar bono inmediatamente.
      if (c.birthdayDate && c.birthdayDate.slice(5) === todayBogota.slice(5)) {
        try {
          await upsertBirthdayBonus(tenantId, client.id, todayYear);
          await sendBirthdayPushToTenant(tenantId, client.id);
        } catch (err) {
          // No bloquear importación por fallo de bono.
          swallow(err, {
            module: "clients",
            op: "import.birthdayBonus",
            tenantId,
          });
        }
      }
    } catch (e) {
      if (isDuplicatePhone(e)) {
        skipped++;
        continue;
      }
      throw e;
    }
  }

  revalidatePath("/clientas");
  return { ok: true, data: { imported, skipped } };
}

/**
 * Sincroniza fechas de cumpleaños desde Google Contacts a clientas existentes.
 * Solo actualiza clientas que todavía no tienen birthday_date.
 * Si hoy es el cumpleaños, dispara el bono inmediatamente (no espera el cron de 5 AM).
 */
export async function syncBirthdaysFromContactsAction(): Promise<
  ActionResult<{ updated: number; bonusFiredToday: number }>
> {
  const { tenantId } = await requireTenant();

  const accessToken = await getAccessTokenForSettings(tenantId);
  if (!accessToken) {
    return {
      ok: false,
      error: "No hay una cuenta de Google conectada para este negocio.",
    };
  }

  // Clientas activas sin cumpleaños registrado.
  const withoutBirthday = await listClientsWithoutBirthday(tenantId);
  if (withoutBirthday.length === 0) {
    return { ok: true, data: { updated: 0, bonusFiredToday: 0 } };
  }

  // Mapa E.164 → clienta local.
  const phoneToClient = new Map(withoutBirthday.map((c) => [c.phone, c]));

  // Traer contactos de Google (raw GoogleContact[]).
  const googleContacts = await fetchGoogleContacts(accessToken);

  // Fecha de hoy en Bogotá.
  const todayBogota = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  const todayYear = parseInt(todayBogota.slice(0, 4), 10);
  const todayMD = todayBogota.slice(5); // "MM-DD"

  let updated = 0;
  let bonusFiredToday = 0;

  for (const contact of googleContacts) {
    // Extraer teléfono normalizado a E.164.
    const rawPhone = contact.phoneNumbers?.[0]?.value?.trim() ?? null;
    if (!rawPhone) continue;
    const phone = normalizePhone(rawPhone);
    if (!phone) continue;

    // Extraer cumpleaños en formato "YYYY-MM-DD".
    const bd = contact.birthdays?.[0]?.date;
    if (!bd) continue;
    const year = bd.year && bd.year > 1 ? bd.year : 1900;
    const birthdayDate = `${year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;

    const client = phoneToClient.get(phone);
    if (!client) continue;

    await updateClientBirthday(tenantId, client.id, birthdayDate);
    updated++;

    // Si cumple años hoy, disparar bono sin esperar el cron.
    if (birthdayDate.slice(5) === todayMD) {
      try {
        await upsertBirthdayBonus(tenantId, client.id, todayYear);
        await sendBirthdayPushToTenant(tenantId, client.id);
        bonusFiredToday++;
      } catch (err) {
        // No bloquear sync por fallo de bono.
        swallow(err, {
          module: "clients",
          op: "syncBirthdays.bonus",
          tenantId,
        });
      }
    }
  }

  revalidatePath("/clientas");
  return { ok: true, data: { updated, bonusFiredToday } };
}

/**
 * Resuelve un grupo de clientas duplicadas conservando una sola.
 * - Sin citas → eliminación permanente.
 * - Con citas → archivado lógico.
 */
const resolveDuplicatesSchema = z.object({
  keepId: z.string().uuid(),
  discardIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function resolveDuplicatesAction(
  keepId: string,
  discardClients: { id: string; appointmentCount: number }[],
): Promise<ActionResult<undefined>> {
  const { tenantId } = await requireTenant();

  // El `appointmentCount` del cliente NO se usa para decidir (audit H-2): un
  // payload manipulado no debe forzar un borrado. El servidor intenta borrar y,
  // si la FK lo impide (tiene citas), archiva — con la DB como fuente de verdad.
  const parsed = resolveDuplicatesSchema.safeParse({
    keepId,
    discardIds: discardClients.map((c) => c.id),
  });
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };

  for (const id of parsed.data.discardIds) {
    if (id === parsed.data.keepId) continue; // nunca borrar la que se conserva
    const deleted = await deleteClient(tenantId, id);
    if (!deleted) await archiveClient(tenantId, id);
  }

  revalidatePath("/clientas");
  revalidatePath("/clientas/duplicados");
  return { ok: true, data: undefined };
}
