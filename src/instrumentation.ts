/**
 * Next.js instrumentation hook (F10.B2).
 * Se ejecuta una vez al iniciar el servidor y registra Sentry según el runtime.
 * Documentación: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Captura errores de React Server Components anidados.
 * Requerido por @sentry/nextjs >= 9.x.
 */
export const onRequestError = Sentry.captureRequestError;
