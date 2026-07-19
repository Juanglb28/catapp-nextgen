import * as Sentry from "@sentry/nextjs";

import { logger, type LogContext } from "@/lib/logger";

/**
 * Registra un error no-bloqueante que decidimos NO propagar (B0.5). Sustituye a
 * los `catch {}` mudos: el efecto secundario (sync a Google, push, bono…) puede
 * fallar sin romper la respuesta al usuario, pero el fallo debe quedar visible
 * para diagnóstico, no perderse en silencio.
 *
 * - `logger.warn` con contexto opaco (sin PII: solo tenantId, ids, operación).
 * - `Sentry.captureException` para agregarlo en producción.
 *
 * Uso:
 *   try { await syncAppointment(...); }
 *   catch (err) { swallow(err, { module: "calendar", op: "sync", tenantId }); }
 */
export function swallow(err: unknown, context: LogContext = {}): void {
  const message =
    err instanceof Error ? err.message : "error no-bloqueante desconocido";
  logger.warn(message, { ...context, swallowed: true });
  Sentry.captureException(err, { extra: context });
}
