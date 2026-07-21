"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { listScheduledWithoutGcalEvent } from "@/modules/appointments/repository";
import { requireTenant } from "@/modules/tenancy/context";

import { revokeToken } from "./google";
import {
  deleteGoogleAccount,
  getRefreshToken,
  updateCalendarSettings,
} from "./repository";
import { syncAppointment } from "./sync";

const settingsSchema = z.object({
  calendarId: z.string().min(1).max(200).optional(),
  syncEnabled: z.boolean().optional(),
});

export async function updateCalendarSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  await updateCalendarSettings(tenantId, parsed.data);
  revalidatePath("/ajustes/calendario");
  return { ok: true };
}

/** Desconecta: revoca el token contra Google y borra la fila local. */
export async function disconnectGoogleAction(): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const refreshToken = await getRefreshToken(tenantId);
  if (refreshToken) {
    await revokeToken(refreshToken);
  }
  await deleteGoogleAccount(tenantId);
  revalidatePath("/ajustes/calendario");
  revalidatePath("/ajustes");
  return { ok: true };
}

/**
 * Backfill: sincroniza las citas agendadas y futuras que aún no tienen evento
 * en Google Calendar (tras conectar). Devuelve cuántas se procesaron.
 */
export async function backfillCalendarAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const { tenantId } = await requireTenant();
  const pending = await listScheduledWithoutGcalEvent(tenantId);
  for (const appointment of pending) {
    await syncAppointment(tenantId, appointment.id);
  }
  revalidatePath("/ajustes/calendario");
  revalidatePath("/citas");
  return { ok: true, count: pending.length };
}

/** Reintenta la sync de una cita concreta (botón "Reintentar" en el detalle). */
export async function retrySyncAction(
  appointmentId: string,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  await syncAppointment(tenantId, appointmentId);
  revalidatePath(`/citas/${appointmentId}`);
  return { ok: true };
}
