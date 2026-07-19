import { eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";

import { type GoogleAccount, googleAccounts } from "./schema";

/**
 * Repositorio de la conexión de Google Calendar — alcance de tenant (D-11).
 * El refresh_token se guarda y lee CIFRADO; solo `getRefreshToken` lo descifra.
 */

export async function getGoogleAccount(
  tenantId: string,
): Promise<GoogleAccount | null> {
  const rows = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

/** Devuelve el refresh_token en claro (uso interno del cliente de Google). */
export async function getRefreshToken(
  tenantId: string,
): Promise<string | null> {
  const account = await getGoogleAccount(tenantId);
  if (!account) return null;
  return decryptSecret(account.refreshTokenEnc);
}

/**
 * Guarda (o re-conecta) la cuenta de Google del tenant. Cifra el refresh_token
 * y marca la conexión como activa. Conserva calendar_id/sync_enabled si ya
 * existían.
 */
export async function saveGoogleAccount(
  tenantId: string,
  data: { googleEmail: string; refreshToken: string },
): Promise<void> {
  const refreshTokenEnc = encryptSecret(data.refreshToken);
  await db
    .insert(googleAccounts)
    .values({
      tenantId,
      googleEmail: data.googleEmail,
      refreshTokenEnc,
    })
    .onConflictDoUpdate({
      target: googleAccounts.tenantId,
      set: {
        googleEmail: data.googleEmail,
        refreshTokenEnc,
        status: "connected",
      },
    });
}

export async function updateCalendarSettings(
  tenantId: string,
  data: { calendarId?: string; syncEnabled?: boolean },
): Promise<void> {
  const set: Partial<typeof googleAccounts.$inferInsert> = {};
  if (data.calendarId !== undefined) set.calendarId = data.calendarId;
  if (data.syncEnabled !== undefined) set.syncEnabled = data.syncEnabled;
  if (Object.keys(set).length === 0) return;
  await db
    .update(googleAccounts)
    .set(set)
    .where(eq(googleAccounts.tenantId, tenantId));
}

/** Marca la conexión como rota (Google revocó el acceso). */
export async function markBroken(tenantId: string): Promise<void> {
  await db
    .update(googleAccounts)
    .set({ status: "broken" })
    .where(eq(googleAccounts.tenantId, tenantId));
}

export async function deleteGoogleAccount(tenantId: string): Promise<void> {
  await db.delete(googleAccounts).where(eq(googleAccounts.tenantId, tenantId));
}
