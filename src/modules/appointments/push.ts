/**
 * Push notifications relacionadas con citas (para la manicurista).
 * La lógica genérica de envío VAPID vive en @/lib/push.
 */
import { sendPushToTenant } from "@/modules/push/send";

export type ClientDecision = "accepted" | "rejected";

/**
 * Notifica a la manicurista cuando la clienta acepta o rechaza su cita desde
 * la página pública. Enlaza al detalle de la cita. No hace nada si el push no
 * está configurado (ver `isPushConfigured`).
 */
export async function sendClientDecisionPush(
  tenantId: string,
  appointmentId: string,
  clientName: string,
  decision: ClientDecision,
  note?: string | null,
): Promise<boolean> {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;

  const payload =
    decision === "accepted"
      ? {
          title: `✅ ${firstName} confirmó su cita`,
          body: "Toca para ver los detalles.",
        }
      : {
          title: `❌ ${firstName} no podrá asistir`,
          body: note?.trim()
            ? `Motivo: ${note.trim()}`
            : "Toca para reagendar o cancelar.",
        };

  return sendPushToTenant(tenantId, {
    ...payload,
    url: `/citas/${appointmentId}`,
  });
}
