import { isPushConfigured, type PushPayload, sendWebPush } from "@/lib/push";

import { deletePushSubscription, getTenantPushSubscriptions } from "./repository";
import type { PushSubscription } from "./schema";

/**
 * Envía una notificación push a TODAS las suscripciones del tenant (B4/R-C3).
 * Orquestación a nivel de módulo: usa la primitiva pura de `@/lib/push` y purga
 * las suscripciones muertas (410/404). Devuelve `true` si se envió al menos una.
 * No hace nada si el push no está configurado.
 */
export async function sendPushToTenant(
  tenantId: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!isPushConfigured()) return false;

  const subs = await getTenantPushSubscriptions(tenantId);
  if (subs.length === 0) return false;

  return sendPushToSubscriptions(subs, payload);
}

/**
 * Envía a un conjunto de suscripciones YA cargadas (B5/R-D2), purgando las
 * muertas (410/404). Para los crons, que precargan las suscripciones de muchos
 * tenants de una vez y evitan el N+1. Devuelve `true` si se envió al menos una.
 */
export async function sendPushToSubscriptions(
  subs: PushSubscription[],
  payload: PushPayload,
): Promise<boolean> {
  if (!isPushConfigured() || subs.length === 0) return false;

  let sent = false;
  for (const sub of subs) {
    const result = await sendWebPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload,
    );
    if (result.ok) sent = true;
    else if (result.gone) await deletePushSubscription(sub.id);
  }
  return sent;
}
