/**
 * Envío genérico de Web Push Notifications (VAPID).
 *
 * Variables de entorno requeridas:
 *   VAPID_PUBLIC_KEY  — clave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY — clave privada VAPID (base64url)
 *   VAPID_SUBJECT     — mailto o URL del remitente (p.ej. mailto:admin@catapp.app)
 *
 * Para generar las claves: npx web-push generate-vapid-keys
 */
import webPush from "web-push";

import {
  deletePushSubscription,
  getTenantPushSubscriptions,
} from "@/modules/birthdays/repository";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

function setupVapid() {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Envía una push notification a todas las suscripciones del tenant.
 * Devuelve `true` si se envió al menos una.
 * No hace nada si las variables VAPID no están configuradas.
 */
export async function sendPushToTenant(
  tenantId: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!isPushConfigured()) return false;
  setupVapid();

  const subs = await getTenantPushSubscriptions(tenantId);
  if (subs.length === 0) return false;

  const data = JSON.stringify(payload);
  let sent = false;

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        data,
      );
      sent = true;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await deletePushSubscription(sub.id);
      }
    }
  }

  return sent;
}
