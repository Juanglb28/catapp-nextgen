import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

import {
  appLockSettings,
  webauthnCredentials,
  type WebauthnCredential,
} from "./schema";

/** Credenciales WebAuthn del usuario. */
export async function listCredentials(
  userId: string,
): Promise<WebauthnCredential[]> {
  return db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));
}

/** Una credencial por su `credentialId` (base64url). */
export async function getCredential(
  credentialId: string,
): Promise<WebauthnCredential | null> {
  const rows = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, credentialId))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveCredential(
  userId: string,
  cred: {
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string | null;
  },
): Promise<void> {
  await db.insert(webauthnCredentials).values({ userId, ...cred });
}

export async function updateCredentialCounter(
  credentialId: string,
  counter: number,
): Promise<void> {
  await db
    .update(webauthnCredentials)
    .set({ counter })
    .where(eq(webauthnCredentials.credentialId, credentialId));
}

export async function deleteCredentials(userId: string): Promise<void> {
  await db
    .delete(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));
}

/**
 * True si el usuario tiene el bloqueo de app activado.
 *
 * Tolerante a fallos a propósito: si la consulta falla (p. ej. la migración
 * 0024 aún no se aplicó en ese entorno), devuelve `false` en vez de propagar
 * el error. El bloqueo es una capa ADICIONAL sobre la sesión de Better Auth,
 * así que "sin bloqueo" degrada la comodidad, no la autenticación; el
 * alternativo sería dejar Finanzas y Ajustes completamente inaccesibles.
 */
export async function isLockEnabled(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ enabled: appLockSettings.enabled })
      .from(appLockSettings)
      .where(eq(appLockSettings.userId, userId))
      .limit(1);
    return rows[0]?.enabled ?? false;
  } catch (err) {
    logger.warn("No se pudo leer app_lock_settings; bloqueo desactivado", {
      module: "security",
      err: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

export async function setLockEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(appLockSettings)
    .values({ userId, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appLockSettings.userId,
      set: { enabled, updatedAt: new Date() },
    });
}
