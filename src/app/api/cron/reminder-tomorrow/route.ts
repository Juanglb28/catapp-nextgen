import { formatTime } from "@/lib/dates";
import { constantTimeEqual } from "@/lib/timing-safe";
import { listTenantsWithAppointmentsTomorrow } from "@/modules/appointments/repository";
import { getSubscriptionsByTenant } from "@/modules/push/repository";
import { sendPushToSubscriptions } from "@/modules/push/send";

export const dynamic = "force-dynamic";

/**
 * Cron de recordatorio nocturno. Se ejecuta a las 8 PM Bogota (01:00 UTC).
 * Por cada tenant con citas scheduled manana, envia una push notification.
 * Protegido por `Authorization: Bearer CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenants = await listTenantsWithAppointmentsTomorrow();
  let notified = 0;

  // Precarga las suscripciones de todos los tenants en UNA query (R-D2).
  const subsByTenant = await getSubscriptionsByTenant(
    tenants.map((t) => t.tenantId),
  );

  for (const { tenantId, timezone, count, firstStartsAt } of tenants) {
    const hora = formatTime(firstStartsAt, timezone);
    const body =
      count === 1
        ? `Tu primera cita es a las ${hora}.`
        : `Tu primera cita es a las ${hora} y tienes ${count} en total.`;

    const sent = await sendPushToSubscriptions(subsByTenant.get(tenantId) ?? [], {
      title:
        count === 1
          ? "📅 Mañana tienes 1 cita"
          : `📅 Mañana tienes ${count} citas`,
      body,
      url: "/citas",
    });

    if (sent) notified++;
  }

  return Response.json({
    ok: true,
    tenantsWithCitas: tenants.length,
    notified,
  });
}
