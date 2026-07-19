"use server";

import { after } from "next/server";

import { sendClientDecisionPush } from "@/modules/appointments/push";
import {
  confirmAppointmentByToken,
  rejectAppointmentByToken,
} from "@/modules/appointments/repository";

export type ConfirmResult = { ok: true } | { ok: false; error: string };

/** Confirma la cita desde la página pública. Sin autenticación — el token es la credencial. */
export async function confirmCitaAction(token: string): Promise<ConfirmResult> {
  const result = await confirmAppointmentByToken(token);
  if (result.status === "ok") {
    // Notifica a la manicurista (no bloquea la respuesta a la clienta).
    after(() =>
      sendClientDecisionPush(
        result.tenantId,
        result.appointmentId,
        result.clientName,
        "accepted",
      ),
    );
    return { ok: true };
  }
  if (result.status === "already_decided")
    return { ok: false, error: "Esta cita ya fue confirmada o rechazada." };
  return { ok: false, error: "No se encontró la cita." };
}

/** Rechaza la cita desde la página pública. Sin autenticación — el token es la credencial. */
export async function rejectCitaAction(
  token: string,
  note: string | null,
): Promise<ConfirmResult> {
  const result = await rejectAppointmentByToken(token, note);
  if (result.status === "ok") {
    after(() =>
      sendClientDecisionPush(
        result.tenantId,
        result.appointmentId,
        result.clientName,
        "rejected",
        note,
      ),
    );
    return { ok: true };
  }
  if (result.status === "already_decided")
    return { ok: false, error: "Esta cita ya fue confirmada o rechazada." };
  return { ok: false, error: "No se encontró la cita." };
}
