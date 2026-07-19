import { isWhatsAppEnabled } from "@/modules/whatsapp/cloud-api";
import {
  appointmentTemplateVariables,
  reminderTemplateName,
  reminderWindow,
} from "@/modules/whatsapp/reminders";
import { listDueReminders } from "@/modules/whatsapp/repository";
import { sendAppointmentTemplate } from "@/modules/whatsapp/send";
import { constantTimeEqual } from "@/lib/timing-safe";

export const dynamic = "force-dynamic";

/**
 * Cron de recordatorios (F8.B2). Protegido por `Authorization: Bearer
 * CRON_SECRET`. Idempotente: `listDueReminders` excluye las citas que ya tienen
 * un `wa_messages` de la plantilla, y cada envío crea esa fila, así que correrlo
 * cada hora nunca duplica.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isWhatsAppEnabled()) {
    return Response.json({
      ok: true,
      due: 0,
      sent: 0,
      skipped: "not_configured",
    });
  }

  const now = new Date();
  const { from, to } = reminderWindow(now);
  const template = reminderTemplateName();
  const due = await listDueReminders(from, to, template);

  let sent = 0;
  for (const d of due) {
    const r = await sendAppointmentTemplate(d.tenantId, {
      appointmentId: d.appointmentId,
      toPhone: d.toPhone,
      templateName: template,
      variables: appointmentTemplateVariables(d),
    });
    if (r.ok) sent++;
  }

  return Response.json({ ok: true, due: due.length, sent });
}
