import { timingSafeEqual } from "node:crypto";

/**
 * Comparación de strings en tiempo constante (B0.6). Evita timing attacks sobre
 * secretos (Bearer de cron, verify token de WhatsApp). `timingSafeEqual` exige
 * buffers de igual longitud, así que se corta temprano si difieren en tamaño
 * (la longitud de un secreto no es sensible). Coherente con el patrón ya usado en
 * `modules/whatsapp/signature.ts` y `lib/app-lock.ts`.
 */
export function constantTimeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
