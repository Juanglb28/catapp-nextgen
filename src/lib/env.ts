import { z } from "zod";

/**
 * Validación de variables de entorno (B0.8). Centraliza qué variables existen,
 * cuáles son obligatorias y su forma. `validateEnv()` se llama al arranque
 * (instrumentation.ts) y hace **fail-fast en producción** si falta una variable
 * crítica, en vez de fallar en silencio a mitad de un request (el bug de "0
 * suscripciones push" de 2026-07 fue exactamente esto). En desarrollo solo avisa.
 *
 * Las variables de integración (Google, WhatsApp, Resend, VAPID, Sentry) son
 * OPCIONALES: si faltan, su módulo queda inerte (feature flag), no rompe el
 * arranque. Solo son obligatorias las que sin ellas la app no puede funcionar.
 */

const envSchema = z.object({
  // Obligatorias (sin ellas la app no arranca correctamente en producción).
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(1, "BETTER_AUTH_SECRET es obligatoria (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL debe ser una URL válida"),

  // Opcionales — integraciones que quedan inertes si faltan.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_TOKEN_KEY: z.string().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_ACCESS_TOKEN: z.string().optional(),
  WA_VERIFY_TOKEN: z.string().optional(),
  WA_APP_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` una vez al arranque. En producción lanza si falta una
 * obligatoria; en desarrollo solo registra un aviso (para no bloquear el dev loop).
 * Idempotente: seguro llamarla varias veces.
 */
export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);
  if (result.success) return;

  const issues = result.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  const msg = `Variables de entorno inválidas o faltantes:\n${issues}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(msg);
  }
  console.warn(`[env] ${msg}`);
}

/** ¿Están las 3 claves VAPID presentes? Fuente única para push (B0.8). */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

/**
 * Devuelve las claves VAPID validadas (no vacías) o `null` si falta alguna.
 * Evita los `process.env.X!` (non-null assertion) dispersos.
 */
export function getVapidConfig(): {
  subject: string;
  publicKey: string;
  privateKey: string;
} | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}
