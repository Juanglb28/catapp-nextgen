/**
 * Push notifications para alertas de cumpleaños.
 * La logica generica de envio vive en @/lib/push.
 */
import type { PushPayload } from "@/lib/push";
import { sendPushToTenant } from "@/modules/push/send";

/** Payload de la notificación de cumpleaños (compartido: envío directo y precargado). */
export function birthdayPushPayload(clientName: string): PushPayload {
  return {
    title: `\u{1F382} ¡Cumpleaños de ${clientName}!`,
    body: "Revisa el bono de cumpleaños y decide si enviarlo.",
    url: "/cumpleanos",
  };
}

/**
 * Envia una push notification de cumpleanos a todas las suscripciones del tenant.
 * Devuelve `true` si se envio al menos una.
 */
export async function sendBirthdayPushToTenant(
  tenantId: string,
  clientName: string,
): Promise<boolean> {
  return sendPushToTenant(tenantId, birthdayPushPayload(clientName));
}
