import { createHmac, timingSafeEqual } from "crypto";

/**
 * Bloqueo de app (segunda capa para Finanzas/Ajustes, D-17).
 * Cookies firmadas con HMAC (BETTER_AUTH_SECRET). El desbloqueo dura
 * `UNLOCK_TTL_MS` desde que se concede (por sesión/tiempo).
 */

/**
 * Secreto para firmar las cookies de app-lock (RG-4). Fail-fast en producción si
 * falta: sin un secreto real, un atacante podría FORJAR la cookie de desbloqueo
 * y saltarse la segunda capa. Se prefiere `APP_LOCK_SECRET` (clave dedicada,
 * opcional) y si no `BETTER_AUTH_SECRET`. En desarrollo se permite un valor
 * inseguro para no bloquear el dev loop. Se resuelve de forma perezosa (no a
 * nivel de módulo) para no romper el build cuando el secreto no está presente.
 */
function getSecret(): string {
  const secret =
    process.env.APP_LOCK_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta APP_LOCK_SECRET/BETTER_AUTH_SECRET: no se pueden firmar las cookies de app-lock (RG-4).",
    );
  }
  return "dev-insecure-app-lock-secret";
}

export const UNLOCK_COOKIE = "catapp_unlock";
export const CHALLENGE_COOKIE = "catapp_wachal";
export const UNLOCK_TTL_MS = 15 * 60 * 1000; // 15 minutos

/** Configuración de Relying Party derivada de BETTER_AUTH_URL. */
export function rpConfig(): { rpName: string; rpID: string; origin: string } {
  const originUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = new URL(originUrl);
  return {
    rpName: "CatApp",
    rpID: url.hostname,
    origin: `${url.protocol}//${url.host}`,
  };
}

function hmac(data: string): Buffer {
  return createHmac("sha256", getSecret()).update(data).digest();
}

/** Firma un objeto como `<b64url(json)>.<b64url(sig)>`. */
export function signPayload(obj: unknown): string {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = hmac(body).toString("base64url");
  return `${body}.${sig}`;
}

/** Verifica y decodifica un payload firmado. Devuelve null si es inválido. */
export function verifyPayload<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body).toString("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

/** Opciones estándar de cookie httpOnly firmada. */
export function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** Token de desbloqueo (cookie) con expiración. */
export function makeUnlockToken(userId: string): string {
  return signPayload({ u: userId, exp: Date.now() + UNLOCK_TTL_MS });
}

/** True si el token de desbloqueo es válido para el usuario y no expiró. */
export function isUnlockValid(
  token: string | undefined,
  userId: string,
): boolean {
  const payload = verifyPayload<{ u: string; exp: number }>(token);
  return !!payload && payload.u === userId && payload.exp > Date.now();
}
