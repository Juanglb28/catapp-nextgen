/**
 * Sentry — configuración del servidor Node.js (F10.B2).
 * Importado vía src/instrumentation.ts en el hook de instrumentación de Next.js.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === "production",

  // No registrar datos personales en los eventos del servidor.
  beforeSend(event) {
    // Eliminar query params de las URLs (pueden contener tokens o IDs sensibles).
    if (event.request?.url) {
      try {
        const u = new URL(event.request.url);
        u.search = "";
        event.request.url = u.toString();
      } catch {
        /* URL malformada — no modificar */
      }
    }

    // Limpiar headers de la request (pueden contener cookies con sesiones).
    if (event.request?.headers) {
      const safe: Record<string, string> = {};
      const ALLOWED_HEADERS = new Set([
        "content-type",
        "x-forwarded-for",
        "user-agent",
        "accept-language",
      ]);
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (ALLOWED_HEADERS.has(k.toLowerCase())) {
          safe[k] = v as string;
        } else {
          safe[k] = "[redacted]";
        }
      }
      event.request.headers = safe;
    }

    // Nunca enviar el body de la request (puede contener datos de formularios).
    if (event.request) {
      delete event.request.data;
    }

    return event;
  },
});
