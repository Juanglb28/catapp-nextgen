import { CalendarPlus, Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { formatDateLong, formatTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import { getClientIp } from "@/lib/rate-limit";
import { buildGoogleCalendarUrl } from "@/modules/appointments/ics";
import { getPublicAppointment } from "@/modules/appointments/repository";
import { consumeRateLimit } from "@/modules/rate-limit/repository";
import { AppointmentConfirmation } from "./appointment-confirmation";

export const metadata: Metadata = {
  title: "Tu cita",
  robots: { index: false, follow: false },
};

// Siempre refleja el estado actual de la cita (sin caché).
export const dynamic = "force-dynamic";

function Unavailable() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="bg-brand/10 text-brand flex size-14 items-center justify-center rounded-2xl text-2xl font-bold">
        CA
      </div>
      <h1 className="text-xl font-semibold">Esta cita ya no está disponible</h1>
      <p className="text-muted-foreground max-w-[28ch] text-sm">
        Es posible que el enlace haya cambiado. Escríbele a tu manicurista para
        confirmar.
      </p>
    </div>
  );
}

export default async function PublicCitaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Rate limit durable: 30 requests por IP por minuto (B3.3). Frena la
  // enumeración masiva del espacio de tokens uuid.
  const h = await headers();
  const ip = getClientIp(h);
  const { allowed } = await consumeRateLimit(`public-cita:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    // 429 vía notFound para no filtrar el rate-limit como señal.
    notFound();
  }

  const appt = await getPublicAppointment(token);

  // La vista pública se cierra cuando la cita quedó pagada o cancelada: la
  // clienta ya conserva el comprobante que le envía la manicurista.
  if (!appt || appt.status === "cancelled" || appt.paymentStatus === "paid") {
    return <Unavailable />;
  }

  const tz = appt.business.timezone;

  // Enlaces de calendario (reutiliza `h` ya obtenido arriba para el rate limit).
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : "";
  const icsHref = `/cita/${token}/evento.ics`;
  const servicios = appt.services
    .map((s) => (s.quantity > 1 ? `${s.name} x${s.quantity}` : s.name))
    .join(", ");
  const googleUrl = buildGoogleCalendarUrl({
    uid: `${appt.id}@catapp`,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    summary: `Cita en ${appt.business.name}`,
    description: `${servicios ? `Servicios: ${servicios}. ` : ""}${base ? `${base}/cita/${token}` : ""}`,
    location: appt.business.publicAddress ?? undefined,
    sequence: appt.sequence,
  });

  const saldoCop = appt.totalCop - appt.paidCop;

  const statusLabel: Record<string, string> = {
    scheduled: "Agendada",
    completed: "Completada",
    no_show: "No se presentó",
  };
  const paymentLabel: Record<string, { text: string; cls: string }> = {
    pending: { text: "Pago pendiente", cls: "bg-amber-100 text-amber-700" },
    partial: { text: "Abono parcial", cls: "bg-blue-100 text-blue-700" },
    paid: { text: "Pagada", cls: "bg-green-100 text-green-700" },
  };
  const paymentBadge = paymentLabel[appt.paymentStatus] ?? paymentLabel.pending;

  return (
    <div className="flex flex-1 flex-col">
      {/* Header negocio */}
      <header className="mb-6 flex items-center gap-3">
        <div className="bg-brand/10 text-brand flex size-11 items-center justify-center rounded-2xl text-lg font-bold">
          CA
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Tu cita en</p>
          <p className="font-semibold">{appt.business.name}</p>
        </div>
      </header>

      {/* Nombre + badge estado */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {appt.clientFirstName}
        </h1>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          {statusLabel[appt.status] ?? appt.status}
        </span>
      </div>

      {/* Detalle */}
      <section className="mt-5 space-y-4 rounded-2xl border p-4">
        {/* Fecha y hora */}
        <div className="flex items-start gap-3">
          <Clock className="text-brand mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium capitalize">
              {formatDateLong(appt.startsAt, tz)}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatTime(appt.startsAt, tz)} – {formatTime(appt.endsAt, tz)}
            </p>
          </div>
        </div>

        {/* Servicios con precio */}
        {appt.services.length > 0 ? (
          <div className="border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Servicios
            </p>
            <ul className="space-y-1">
              {appt.services.map((s, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>
                    {s.name}
                    {s.quantity > 1 ? ` ×${s.quantity}` : ""}
                  </span>
                  <span className="font-medium">
                    {formatCOP(s.priceCop * BigInt(s.quantity))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Totales */}
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatCOP(appt.totalCop)}</span>
          </div>
          {appt.paidCop > 0n ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagado</span>
              <span className="font-medium text-green-600">
                {formatCOP(appt.paidCop)}
              </span>
            </div>
          ) : null}
          {saldoCop > 0n ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo</span>
              <span className="font-semibold text-amber-600">
                {formatCOP(saldoCop)}
              </span>
            </div>
          ) : null}
          <div className="pt-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge.cls}`}
            >
              {paymentBadge.text}
            </span>
          </div>
        </div>

        {/* Dirección — enlace a Google Maps para llegar de un toque (QW-7). */}
        {appt.business.publicAddress ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              appt.business.publicAddress,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 border-t pt-3"
          >
            <MapPin className="text-brand mt-0.5 size-5 shrink-0" aria-hidden />
            <span className="text-sm whitespace-pre-wrap">
              {appt.business.publicAddress}
              <span className="text-brand mt-0.5 block text-xs font-medium">
                Ver en el mapa →
              </span>
            </span>
          </a>
        ) : null}

        {/* Nota pública */}
        {appt.business.publicNote ? (
          <p className="text-muted-foreground border-t pt-3 text-sm whitespace-pre-wrap">
            {appt.business.publicNote}
          </p>
        ) : null}
      </section>

      {appt.status === "scheduled" && (
        <div className="mt-6">
          <AppointmentConfirmation
            token={token}
            initialConfirmation={appt.clientConfirmation}
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Button asChild className="w-full" variant="outline">
          <a href={icsHref}>
            <CalendarPlus className="size-4" />
            Agregar a mi calendario
          </a>
        </Button>
        <Button asChild className="w-full" variant="outline">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer">
            <CalendarPlus className="size-4" />
            Google Calendar
          </a>
        </Button>
        {appt.business.phone ? (
          <Button asChild className="w-full">
            <a
              href={whatsappLink(appt.business.phone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="size-4" />
              Escribir a {appt.business.name}
            </a>
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-auto pt-8 text-center text-xs">
        Hecho con CatApp
      </p>
    </div>
  );
}
