import { constantTimeEqual } from "@/lib/timing-safe";
import { deleteStaleUnverifiedUsers } from "@/modules/tenancy/repository";

export const dynamic = "force-dynamic";

/** Cuentas sin verificar más viejas que esto se consideran abandonadas. */
const STALE_HOURS = 48;

/**
 * Cron de limpieza de cuentas nunca verificadas. Corre una vez al día.
 * Protegido por `Authorization: Bearer CRON_SECRET`.
 *
 * Sin esto, una cuenta que nunca confirma su correo (typo, bot, o alguien que
 * se arrepintió) deja ese correo "reservado" para siempre, porque el registro
 * rechaza reusar un email ya existente aunque esté sin verificar. Ver
 * `docs/CRONS.md` y `docs/DEV-SETUP.md` (§ Resend) para el contexto completo.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
  const deleted = await deleteStaleUnverifiedUsers(cutoff);

  return Response.json({ ok: true, deleted, staleHours: STALE_HOURS });
}
