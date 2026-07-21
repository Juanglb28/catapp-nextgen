import {
  listClientsBirthdayToday,
  upsertBirthdayBonus,
} from "@/modules/birthdays/repository";
import { birthdayPushPayload } from "@/modules/birthdays/push";
import { getSubscriptionsByTenant } from "@/modules/push/repository";
import { sendPushToSubscriptions } from "@/modules/push/send";
import { constantTimeEqual } from "@/lib/timing-safe";

export const dynamic = "force-dynamic";

/**
 * Cron de cumpleaños. Se ejecuta una vez al día (ej. 8:00 AM Bogotá).
 * Protegido por `Authorization: Bearer CRON_SECRET`.
 *
 * Por cada clienta con cumpleaños hoy:
 *  1. Crea (o recupera) el `birthday_bonus` del año en curso.
 *  2. Envía push notification a la manicurista.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clients = await listClientsBirthdayToday();
  let created = 0;
  let notified = 0;

  // Precarga las suscripciones de todos los tenants con cumpleaños hoy en UNA
  // query (R-D2), en vez de una por cada notificación.
  const tenantIds = [...new Set(clients.map((c) => c.tenantId))];
  const subsByTenant = await getSubscriptionsByTenant(tenantIds);

  for (const c of clients) {
    // Crea el bono del año en curso EN LA TZ DEL TENANT (R-D4).
    const bonus = await upsertBirthdayBonus(c.tenantId, c.clientId, c.year);

    // Solo notifica si el bono está recién creado (pending_manicurist).
    if (bonus.status === "pending_manicurist") {
      created++;
      const sent = await sendPushToSubscriptions(
        subsByTenant.get(c.tenantId) ?? [],
        birthdayPushPayload(c.clientName),
      );
      if (sent) notified++;
    }
  }

  return Response.json({
    ok: true,
    clients: clients.length,
    created,
    notified,
  });
}
