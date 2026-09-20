import { constantTimeEqual } from "@/lib/timing-safe";
import { overduePaymentsPushPayload } from "@/modules/finance/push";
import { listTenantsWithOverduePayments } from "@/modules/finance/repository";
import { getSubscriptionsByTenant } from "@/modules/push/repository";
import { sendPushToSubscriptions } from "@/modules/push/send";

export const dynamic = "force-dynamic";

/**
 * Cron de recordatorio de cobro (D-32). Se ejecuta una vez al día
 * (8:00 AM Bogotá = 13:00 UTC). Por cada tenant con citas completadas y con
 * saldo pendiente de un día anterior (D-29), envía una push que lleva a
 * `/citas?view=pendientes`. Sin estado: recuerda cada día mientras haya deuda.
 * Protegido por `Authorization: Bearer CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenants = await listTenantsWithOverduePayments();
  let notified = 0;

  // Precarga las suscripciones de todos los tenants en UNA query (R-D2).
  const subsByTenant = await getSubscriptionsByTenant(
    tenants.map((t) => t.tenantId),
  );

  for (const t of tenants) {
    const sent = await sendPushToSubscriptions(
      subsByTenant.get(t.tenantId) ?? [],
      overduePaymentsPushPayload(t),
    );
    if (sent) notified++;
  }

  return Response.json({
    ok: true,
    tenantsWithOverdue: tenants.length,
    notified,
  });
}
