import {
  listClientsBirthdayToday,
  upsertBirthdayBonus,
} from "@/modules/birthdays/repository";
import { sendBirthdayPushToTenant } from "@/modules/birthdays/push";
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

  const year = new Date().getFullYear();

  for (const c of clients) {
    // Crea el bono si no existe ya este año.
    const bonus = await upsertBirthdayBonus(c.tenantId, c.clientId, year);

    // Solo notifica si el bono está recién creado (pending_manicurist).
    if (bonus.status === "pending_manicurist") {
      created++;
      const sent = await sendBirthdayPushToTenant(c.tenantId, c.clientName);
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
