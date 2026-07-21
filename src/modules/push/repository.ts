import { eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { pushSubscriptions } from "./schema";

/**
 * Repositorio de suscripciones Web Push (B4/R-C3). Movido desde `birthdays` para
 * que el push tenga su propio módulo. Sin alcance de tenant en el borrado por id
 * (la fila ya pertenece al tenant que la creó y solo se borra por endpoint muerto).
 */

/** Almacena (o actualiza) una suscripción Web Push del tenant (upsert por endpoint). */
export async function savePushSubscription(
  tenantId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      tenantId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        tenantId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });
}

/** Todas las suscripciones push del tenant. */
export async function getTenantPushSubscriptions(tenantId: string) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.tenantId, tenantId));
}

/** Elimina una suscripción por id (p. ej. cuando el endpoint ya no existe). */
export async function deletePushSubscription(id: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
