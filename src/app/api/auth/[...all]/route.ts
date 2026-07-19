import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const handler = toNextJsHandler(auth);

export const { GET } = handler;

/**
 * POST handler with rate limiting on sign-in / sign-up paths (F10.B1).
 *
 * Limit: 10 attempts per IP per minute. After that, 429 Too Many Requests.
 * All other auth POST paths (sign-out, etc.) are not rate limited.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  const isAuthPath =
    url.pathname.startsWith("/api/auth/sign-in") ||
    url.pathname.startsWith("/api/auth/sign-up");

  if (isAuthPath) {
    const ip = getClientIp(request);
    const allowed = checkRateLimit(`auth:${ip}`, {
      capacity: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Demasiados intentos. Espera un momento." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        },
      );
    }
  }

  return handler.POST(request);
}
