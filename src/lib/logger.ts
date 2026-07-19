/**
 * Logger estructurado mínimo (F10.B2).
 *
 * Formato: JSON en producción (legible por Railway Logs y herramientas de
 * análisis); texto plano en desarrollo (más legible en la terminal).
 *
 * Reglas de privacidad (RNF-03):
 *  - NUNCA incluir nombres, teléfonos, emails ni notas de clientas.
 *  - El `tenantId` es seguro para logs (UUID opaco, sin PII).
 *  - Los IDs de citas/productos son UUIDs opacos — seguros.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *
 *   // Log simple:
 *   logger.info("Cita creada", { tenantId, appointmentId });
 *
 *   // Con contexto fijo (p.ej. dentro de un módulo):
 *   const log = logger.child({ module: "calendar" });
 *   log.error("Error sincronizando", { tenantId, err });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Tenant que realizó la acción (UUID opaco — sin PII). */
  tenantId?: string;
  /** Módulo o componente que emite el log. */
  module?: string;
  /** Campos adicionales opacos (IDs, contadores, duraciones). */
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === "production";
const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function emit(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): void {
  if (!shouldLog(level)) return;

  if (IS_PROD) {
    // Formato JSON estructurado para Railway Logs / Sentry breadcrumbs.
    const entry = {
      level,
      msg: message,
      ts: new Date().toISOString(),
      ...context,
    };
    const fn = level === "error" ? console.error : console.log;
    fn(JSON.stringify(entry));
  } else {
    // Formato legible en desarrollo.
    const prefix = `[${level.toUpperCase()}]`;
    const ctx =
      Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(`${prefix} ${message}${ctx}`);
  }
}

function child(parentCtx: LogContext) {
  return {
    debug: (msg: string, ctx?: LogContext) =>
      emit("debug", msg, { ...parentCtx, ...ctx }),
    info: (msg: string, ctx?: LogContext) =>
      emit("info", msg, { ...parentCtx, ...ctx }),
    warn: (msg: string, ctx?: LogContext) =>
      emit("warn", msg, { ...parentCtx, ...ctx }),
    error: (msg: string, ctx?: LogContext) =>
      emit("error", msg, { ...parentCtx, ...ctx }),
    child: (ctx: LogContext) => child({ ...parentCtx, ...ctx }),
  };
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
  /** Crea un sub-logger con contexto fijo (p.ej. módulo, tenantId). */
  child,
};
