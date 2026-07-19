import { getAppointment } from "@/modules/appointments/repository";
import { getTenant } from "@/modules/tenancy/repository";

import { isWhatsAppEnabled } from "./cloud-api";
import {
  appointmentTemplateVariables,
  confirmationTemplateName,
} from "./reminders";
import { sendAppointmentTemplate } from "./send";

/**
 * Envía la confirmación automática al crear una cita (F8.B2), respetando el
 * feature flag, el toggle del tenant (`auto_messages`) y el opt-out de la
 * clienta. No bloqueante: se llama desde `after()`. Si algo falta, no hace nada.
 */
export async function maybeSendAppointmentConfirmation(
  tenantId: string,
  appointmentId: string,
): Promise<void> {
  if (!isWhatsAppEnabled()) return;

  const tenant = await getTenant(tenantId);
  if (!tenant?.autoMessages) return;

  const appointment = await getAppointment(tenantId, appointmentId);
  if (!appointment || appointment.client.waOptOut) return;

  await sendAppointmentTemplate(tenantId, {
    appointmentId,
    toPhone: appointment.client.phone,
    templateName: confirmationTemplateName(),
    variables: appointmentTemplateVariables({
      clientName: appointment.client.name,
      startsAt: appointment.startsAt,
      timezone: tenant.timezone,
      publicToken: appointment.publicToken,
    }),
  });
}
