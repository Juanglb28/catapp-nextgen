import { buildIcs } from "@/modules/appointments/ics";
import { getPublicAppointment } from "@/modules/appointments/repository";

// Siempre refleja el estado actual de la cita (sin caché).
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const appt = await getPublicAppointment(token);
  if (!appt || appt.status === "cancelled") {
    return new Response("Esta cita ya no está disponible.", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const link = `${origin}/cita/${token}`;
  const servicios = appt.services
    .map((s) => (s.quantity > 1 ? `${s.name} x${s.quantity}` : s.name))
    .join(", ");

  const ics = buildIcs({
    uid: `${appt.id}@catapp`,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    summary: `Cita en ${appt.business.name}`,
    description: `${servicios ? `Servicios: ${servicios}. ` : ""}${link}`,
    location: appt.business.publicAddress ?? undefined,
    sequence: appt.sequence,
    url: link,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cita.ics"',
    },
  });
}
