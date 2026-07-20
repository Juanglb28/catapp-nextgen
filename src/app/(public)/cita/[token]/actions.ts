"use server";

import { after } from "next/server";
import { z } from "zod";

import { sendClientDecisionPush } from "@/modules/appointments/push";
import {
  confirmAppointmentByToken,
  rejectAppointmentByToken,
} from "@/modules/appointments/repository";

export type ConfirmResult = { ok: true } | { ok: false; error: string };

// Entrada NO confiable (endpoint público sin sesión): el token es un UUID y la
// nota se acota/sanea antes de llegar al push o a la DB (B2.3, audit H-14/B7).
const tokenSchema = z.string().uuid();
const noteSchema = z.string().trim().max(300).optional();

/** Confirma la cita desde la página pública. Sin autenticación — el token es la credencial. */
export async function confirmCitaAction(token: string): Promise<ConfirmResult> {
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success) return { ok: false, error: "No se encontró la cita." };

  const result = await confirmAppointmentByToken(parsedToken.data);
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
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success) return { ok: false, error: "No se encontró la cita." };

  const parsedNote = noteSchema.safeParse(note ?? undefined);
  const cleanNote = parsedNote.success ? (parsedNote.data ?? null) : null;

  const result = await rejectAppointmentByToken(parsedToken.data, cleanNote);
  if (result.status === "ok") {
    after(() =>
      sendClientDecisionPush(
        result.tenantId,
        result.appointmentId,
        result.clientName,
        "rejected",
        cleanNote,
      ),
    );
    return { ok: true };
  }
  if (result.status === "already_decided")
    return { ok: false, error: "Esta cita ya fue confirmada o rechazada." };
  return { ok: false, error: "No se encontró la cita." };
}
