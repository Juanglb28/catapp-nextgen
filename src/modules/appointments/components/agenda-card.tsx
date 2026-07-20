import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { formatTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";

import { type AgendaAppointment } from "../repository";

const PAYMENT_TAG: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pago pendiente", cls: "bg-amber-50 text-amber-700" },
  partial: { label: "Pago parcial", cls: "bg-sky-50 text-sky-700" },
  paid: { label: "Pago completo", cls: "bg-emerald-50 text-emerald-700" },
};

const CONFIRMATION_TAG: Record<string, { label: string; cls: string }> = {
  pending: { label: "Sin confirmar", cls: "bg-slate-100 text-slate-500" },
  accepted: { label: "✓ Confirmada", cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "✕ Rechazada", cls: "bg-red-50 text-red-600" },
};

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completada", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelada", cls: "bg-red-50 text-red-600" },
  no_show: { label: "No asistió", cls: "bg-slate-100 text-slate-600" },
};

export function AgendaCard({
  appt,
  tz,
  reminderHref,
}: {
  appt: AgendaAppointment;
  tz: string;
  /** Si se pasa, muestra un botón wa.me de recordatorio (QW-5). */
  reminderHref?: string;
}) {
  const services = appt.serviceSummary
    .map((s) => (s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name))
    .join(", ");

  const durationMin = Math.round(
    (appt.endsAt.getTime() - appt.startsAt.getTime()) / 60000,
  );

  const payTag = PAYMENT_TAG[appt.paymentStatus];
  const statusTag = STATUS_TAG[appt.status];
  const confirmTag =
    appt.status === "scheduled"
      ? CONFIRMATION_TAG[appt.clientConfirmation]
      : undefined;

  return (
    <div className="bg-card overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link href={`/citas/${appt.id}`} className="block p-3">
      <div className="flex items-start gap-3">
        {/* Columna de hora */}
        <div className="flex min-w-[46px] flex-col items-center gap-0.5 pt-0.5">
          <span className="text-primary text-sm leading-tight font-bold">
            {formatTime(appt.startsAt, tz)}
          </span>
          <span className="text-muted-foreground text-[10px] font-medium">
            {durationMin}min
          </span>
        </div>

        {/* Divisor vertical gradiente */}
        <div
          className="w-px self-stretch"
          style={{
            background:
              "linear-gradient(to bottom, transparent, #CFFAFE, transparent)",
          }}
          aria-hidden
        />

        {/* Contenido central */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{appt.clientName}</p>
          {services ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {services}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {appt.status === "scheduled" && payTag && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${payTag.cls}`}
              >
                {payTag.label}
              </span>
            )}
            {statusTag && appt.status !== "scheduled" && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTag.cls}`}
              >
                {statusTag.label}
              </span>
            )}
            {confirmTag && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${confirmTag.cls}`}
              >
                {confirmTag.label}
              </span>
            )}
          </div>
        </div>

        {/* Precio */}
        <div className="shrink-0 pt-0.5 text-right">
          <p className="text-sm font-bold">{formatCOP(appt.totalCop)}</p>
        </div>
      </div>
      </Link>
      {reminderHref ? (
        <a
          href={reminderHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 border-t bg-emerald-50 py-2 text-xs font-semibold text-emerald-700"
        >
          <MessageCircle className="size-4" />
          Enviar recordatorio por WhatsApp
        </a>
      ) : null}
    </div>
  );
}
