/**
 * Primitiva de envío Web Push (VAPID). Capa de bajo nivel, SIN dependencias de
 * módulos (B4/R-C3): recibe una suscripción concreta y envía. La orquestación
 * por tenant (buscar suscripciones, purgar las muertas) vive en el módulo push
 * (`@/modules/push/send`), que sí puede tocar el repositorio.
 *
 * Variables de entorno: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Genera las claves con: npx web-push generate-vapid-keys
 */
import webPush from "web-push";

import { getVapidConfig, isPushConfigured } from "@/lib/env";

export { isPushConfigured };

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Datos mínimos de una suscripción para enviar (sin acoplar al schema). */
export interface WebPushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Resultado de un envío individual. */
export interface WebPushResult {
  /** El envío fue aceptado. */
  ok: boolean;
  /** El endpoint ya no existe (410 Gone / 404): el llamador debe borrar la sub. */
  gone: boolean;
}

function setupVapid(): void {
  const vapid = getVapidConfig();
  if (!vapid) return;
  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
}

/**
 * Envía una notificación a UNA suscripción. No lanza: traduce el error a
 * `{ ok, gone }` para que el llamador decida (purgar la sub si `gone`).
 */
export async function sendWebPush(
  target: WebPushTarget,
  payload: PushPayload,
): Promise<WebPushResult> {
  if (!isPushConfigured()) return { ok: false, gone: false };
  setupVapid();
  try {
    await webPush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 410 || status === 404 };
  }
}
