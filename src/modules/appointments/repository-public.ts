import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients } from "@/modules/clients/schema";
import { services } from "@/modules/services/schema";
import { tenants } from "@/modules/tenancy/schema";

import { appointmentServices, appointments } from "./schema";

/**
 * Superficie PÚBLICA de citas (B4/R-C1): resolución y decisión por `public_token`,
 * SIN alcance de tenant (el token uuid es la credencial, D-07). Separada del
 * repositorio principal para aislar la superficie sin tenant (relevante para el
 * rollout de RLS, R-B6). Solo devuelve datos públicos; nunca el teléfono de la
 * clienta ni datos de otro tenant.
 */

export type PublicAppointment = {
  id: string;
  sequence: number;
  status: string;
  paymentStatus: string;
  totalCop: bigint;
  paidCop: bigint;
  startsAt: Date;
  endsAt: Date;
  clientFirstName: string;
  clientConfirmation: "pending" | "accepted" | "rejected";
  business: {
    name: string;
    phone: string | null;
    publicAddress: string | null;
    publicNote: string | null;
    timezone: string;
  };
  services: { name: string; quantity: number; priceCop: bigint }[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resuelve una cita por su `public_token` para la página pública de la clienta
 * (D-07). SIN alcance de tenant: el token uuid es la credencial. Devuelve solo
 * datos públicos (negocio, nombre de pila, fecha/hora, servicios) — NUNCA
 * precios ni el teléfono de la clienta.
 */
export async function getPublicAppointment(
  token: string,
): Promise<PublicAppointment | null> {
  if (!UUID_RE.test(token)) return null;

  const [row] = await db
    .select({
      apptId: appointments.id,
      sequence: appointments.sequence,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      totalCop: appointments.totalCop,
      paidCop: appointments.paidCop,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      clientConfirmation: appointments.clientConfirmation,
      clientName: clients.name,
      bizName: tenants.name,
      bizPhone: tenants.phone,
      bizAddress: tenants.publicAddress,
      bizNote: tenants.publicNote,
      bizTz: tenants.timezone,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(tenants, eq(tenants.id, appointments.tenantId))
    .where(eq(appointments.publicToken, token))
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select({
      name: services.name,
      quantity: appointmentServices.quantity,
      priceCop: appointmentServices.priceCop,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(eq(appointmentServices.appointmentId, row.apptId));

  return {
    id: row.apptId,
    sequence: row.sequence,
    status: row.status,
    paymentStatus: row.paymentStatus,
    totalCop: row.totalCop,
    paidCop: row.paidCop,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    clientFirstName: row.clientName.trim().split(/\s+/)[0] || row.clientName,
    clientConfirmation: row.clientConfirmation,
    business: {
      name: row.bizName,
      phone: row.bizPhone,
      publicAddress: row.bizAddress,
      publicNote: row.bizNote,
      timezone: row.bizTz,
    },
    services: lines,
  };
}

/**
 * Resultado de una decisión de la clienta (confirmar/rechazar). En caso `ok`
 * incluye los datos para notificar a la manicurista por push.
 */
export type ClientDecisionResult =
  | {
      status: "ok";
      tenantId: string;
      appointmentId: string;
      clientName: string;
    }
  | { status: "not_found" }
  | { status: "already_decided" };

/**
 * Confirma una cita desde la página pública (sin auth, token como credencial).
 * Solo acepta si está en estado `scheduled` y confirmación `pending`.
 */
export async function confirmAppointmentByToken(
  token: string,
): Promise<ClientDecisionResult> {
  if (!UUID_RE.test(token)) return { status: "not_found" };

  const [row] = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      clientName: clients.name,
      clientConfirmation: appointments.clientConfirmation,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.publicToken, token))
    .limit(1);

  if (!row) return { status: "not_found" };
  if (row.clientConfirmation !== "pending")
    return { status: "already_decided" };
  if (row.status === "cancelled") return { status: "not_found" };

  await db
    .update(appointments)
    .set({ clientConfirmation: "accepted" })
    .where(eq(appointments.id, row.id));

  return {
    status: "ok",
    tenantId: row.tenantId,
    appointmentId: row.id,
    clientName: row.clientName,
  };
}

/**
 * Rechaza una cita desde la página pública (sin auth, token como credencial).
 * Solo acepta si está en estado `scheduled` y confirmación `pending`.
 */
export async function rejectAppointmentByToken(
  token: string,
  note: string | null,
): Promise<ClientDecisionResult> {
  if (!UUID_RE.test(token)) return { status: "not_found" };

  const [row] = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      clientName: clients.name,
      clientConfirmation: appointments.clientConfirmation,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.publicToken, token))
    .limit(1);

  if (!row) return { status: "not_found" };
  if (row.clientConfirmation !== "pending")
    return { status: "already_decided" };
  if (row.status === "cancelled") return { status: "not_found" };

  await db
    .update(appointments)
    .set({
      clientConfirmation: "rejected",
      clientRejectionNote: note ?? null,
    })
    .where(eq(appointments.id, row.id));

  return {
    status: "ok",
    tenantId: row.tenantId,
    appointmentId: row.id,
    clientName: row.clientName,
  };
}
