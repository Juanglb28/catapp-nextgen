/**
 * Push notifications para alertas de cumpleaños.
 * La logica generica de envio vive en @/lib/push.
 */
import { sendPushToTenant } from "@/lib/push";

/**
 * Envia una push notification de cumpleanos a todas las suscripciones del tenant.
 * Devuelve `true` si se envio al menos una.
 */
export async function sendBirthdayPushToTenant(
  tenantId: string,
  clientName: string,
): Promise<boolean> {
  return sendPushToTenant(tenantId, {
    title: `\u{1F382} ¡Cumpleaños de ${clientName}!`,
    body: "Revisa el bono de cumpleaños y decide si enviarlo.",
    url: "/cumpleanos",
  });
}
