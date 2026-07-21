"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { getClientIp } from "@/lib/rate-limit";
import { sendClientDecisionPush } from "@/modules/appointments/push";
import {
  confirmAppointmentByToken,
  rejectAppointmentByToken,
} from "@/modules/appointments/repository";
import { consumeRateLimit } from "@/modules/rate-limit/repository";

export type ConfirmResult = { ok: true } | { ok: false; error: string };

// Entrada NO confiable (endpoint público sin sesión): el token es un UUID y la
// nota se acota/sanea antes de llegar al push o a la DB (B2.3, audit H-14/B7).
const tokenSchema = z.string().uuid();
const noteSchema = z.string().trim().max(300).optional();

/**
 * Rate-limit por IP para el endpoint público de cita (B3.3): 20/min. Frena la
 * enumeración de tokens y el spam de decisiones. Fail-open si la DB no responde.
 */
async function citaRateLimitOk(): Promise<boolean> {
  const ip = getClientIp(await headers());
  const { allowed } = await consumeRateLimit(`cita:${ip}`, {
    limit: 20,
    windowMs: 60_000,
  });
  return allowed;
}

/** Confirma la cita desde la página pública. Sin autenticación — el token es la credencial. */
export async function confirmCitaAction(token: string): Promise<ConfirmResult> {
  if (!(await citaRateLimitOk()))
    return { ok: false, error: "Demasiados intentos. Espera un momento." };

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
  if (!(await citaRateLimitOk()))
    return { ok: false, error: "Demasiados intentos. Espera un momento." };

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
