import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";

import { type PushSubscription, pushSubscriptions } from "./schema";

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

/**
 * Precarga las suscripciones de varios tenants en UNA query, agrupadas por tenant
 * (B5/R-D2). Evita el N+1 de los crons que envían push a muchos tenants/clientas
 * (antes: una query de suscripciones por cada envío).
 */
export async function getSubscriptionsByTenant(
  tenantIds: string[],
): Promise<Map<string, PushSubscription[]>> {
  const map = new Map<string, PushSubscription[]>();
  if (tenantIds.length === 0) return map;

  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.tenantId, tenantIds));

  for (const row of rows) {
    const bucket = map.get(row.tenantId);
    if (bucket) bucket.push(row);
    else map.set(row.tenantId, [row]);
  }
  return map;
}

/** Elimina una suscripción por id (p. ej. cuando el endpoint ya no existe). */
export async function deletePushSubscription(id: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
