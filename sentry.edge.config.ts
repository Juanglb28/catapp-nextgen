/**
 * Sentry — configuración para Edge Runtime (F10.B2).
 * Solo el middleware de Next.js corre en Edge; las Server Actions y route
 * handlers usan Node.js. Configuración mínima — sin tracing complejo.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
