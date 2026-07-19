import { WhatsAppError, isWhatsAppEnabled, sendTemplate } from "./cloud-api";
import { markFailed, markSent, queueMessage } from "./messages";

/**
 * Servicio de envío (F8.B1): único punto por el que pasa un envío real. Crea la
 * fila `queued`, intenta enviar y la marca `sent` o `failed`. Si WhatsApp no está
 * configurado, no hace nada (feature flag inerte).
 */

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

export async function sendAppointmentTemplate(
  tenantId: string,
  params: {
    appointmentId?: string | null;
    toPhone: string;
    templateName: string;
    variables?: string[];
  },
): Promise<SendResult> {
  if (!isWhatsAppEnabled()) return { ok: false, reason: "not_configured" };

  const id = await queueMessage(tenantId, {
    appointmentId: params.appointmentId ?? null,
    toPhone: params.toPhone,
    templateName: params.templateName,
  });

  // null = ya existía ese template para esta cita (idempotencia B0.2): no reenviar.
  if (id === null) return { ok: false, reason: "already_queued" };

  try {
    const waMessageId = await sendTemplate(
      params.toPhone,
      params.templateName,
      params.variables ?? [],
    );
    await markSent(id, waMessageId);
    return { ok: true, id };
  } catch (e) {
    const reason = e instanceof WhatsAppError ? e.kind : "unknown";
    await markFailed(id, e instanceof Error ? e.message : "unknown");
    return { ok: false, reason };
  }
}
