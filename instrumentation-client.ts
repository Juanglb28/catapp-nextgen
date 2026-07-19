/**
 * Sentry — configuración del cliente (navegador) (F10.B2).
 * Archivo: instrumentation-client.ts (convención Next.js 15+).
 * Reemplaza el antiguo sentry.client.config.ts.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Captura el 10% de las transacciones para performance monitoring.
  // Subir a 1.0 en desarrollo o en el primer día de producción para calibrar.
  tracesSampleRate: 0.1,

  // Solo activo en producción; en desarrollo se usan los logs de la consola.
  enabled: process.env.NODE_ENV === "production",

  /**
   * Filtrar datos sensibles antes de enviar a Sentry (RNF-03).
   * Se eliminan teléfonos (formato colombiano +57 y E.164) y los campos
   * que podrían contener nombres o notas de clientas.
   */
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});

/**
 * Instrumenta las transiciones de navegación del router de Next.js.
 * Requerido por @sentry/nextjs >= 9.x para trazar navegaciones client-side.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

type SentryEvent = Parameters<
  NonNullable<Parameters<typeof Sentry.init>[0]["beforeSend"]>
>[0];

function scrubSentryEvent(event: SentryEvent): SentryEvent {
  // Limpiar breadcrumbs que puedan tener datos personales en la URL o mensaje.
  if (Array.isArray(event.breadcrumbs) && event.breadcrumbs.length > 0) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? redact(b.message) : b.message,
      data: b.data ? scrubObject(b.data) : b.data,
    }));
  }

  // Limpiar extras y contextos.
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) {
    event.contexts = Object.fromEntries(
      Object.entries(event.contexts).map(([k, v]) => [
        k,
        v ? scrubObject(v as Record<string, unknown>) : v,
      ]),
    );
  }

  return event;
}

const PHONE_RE = /(\+57|0057)?[3][0-9]{9}/g;
const NAME_FIELDS = new Set(["name", "phone", "email", "notes", "clientName"]);

function redact(s: string): string {
  return s.replace(PHONE_RE, "[phone]");
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (NAME_FIELDS.has(k)) return [k, "[redacted]"];
      if (typeof v === "string") return [k, redact(v)];
      return [k, v];
    }),
  );
}
