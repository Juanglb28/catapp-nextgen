import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";
import { consumeRateLimit } from "@/modules/rate-limit/repository";

const handler = toNextJsHandler(auth);

export const { GET } = handler;

/**
 * POST handler con rate limiting durable en sign-in / sign-up / reenvío de
 * verificación (B3.3).
 *
 * Límite: 10 intentos por IP por minuto → 429. El resto de rutas de auth
 * (sign-out, etc.) no se limitan.
 *
 * `send-verification-email` está incluido a propósito: es la ruta que usa el
 * botón "Reenviar correo de confirmación" (`login-form.tsx`), no requiere
 * contraseña ni sesión, y sin límite alguien podría usarla para bombardear de
 * correos la bandeja de un tercero (con solo saber su email).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  const isAuthPath =
    url.pathname.startsWith("/api/auth/sign-in") ||
    url.pathname.startsWith("/api/auth/sign-up") ||
    url.pathname.startsWith("/api/auth/send-verification-email");

  if (isAuthPath) {
    const ip = getClientIp(request);
    const { allowed, retryAfterSec } = await consumeRateLimit(`auth:${ip}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Demasiados intentos. Espera un momento." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }
  }

  return handler.POST(request);
}
