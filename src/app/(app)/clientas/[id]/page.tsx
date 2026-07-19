import { CalendarClock, CalendarPlus, Cake, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateShort, formatTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { formatPhoneCO, telLink, whatsappLink } from "@/lib/phone";
import { paymentBadgeClass } from "@/modules/appointments/agenda";
import {
  clientAppointmentStats,
  listAppointmentsByClient,
} from "@/modules/appointments/repository";
import { getActiveBonusForClient } from "@/modules/birthdays/repository";
import { BIRTHDAY_OPTION_LABELS } from "@/modules/birthdays/schema";
import { ClientDetailActions } from "@/modules/clients/components/client-detail-actions";
import { OptOutToggle } from "@/modules/clients/components/opt-out-toggle";
import { getClient } from "@/modules/clients/repository";
import { type ClientFormInput } from "@/modules/clients/validation";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";

/** Formatea "YYYY-MM-DD" a "DD de MMMM" en español. */
function formatBirthday(date: string): string {
  // date = "YYYY-MM-DD"
  const [, mm, dd] = date.split("-");
  const d = new Date(`2000-${mm}-${dd}T00:00:00`);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

export const metadata: Metadata = { title: "Clienta" };

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pendiente",
  partial: "Abono",
  paid: "Pagada",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const client = await getClient(tenantId, id);
  if (!client) notFound();

  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const [history, stats, activeBonus] = await Promise.all([
    listAppointmentsByClient(tenantId, id, { page }),
    clientAppointmentStats(tenantId, id),
    getActiveBonusForClient(tenantId, id),
  ]);

  const formValues: ClientFormInput = {
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    notes: client.notes ?? "",
    birthdayDate: client.birthdayDate ?? "",
  };

  return (
    <div className="space-y-6">
      <Link
        href="/clientas"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Clientas
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <p className="text-muted-foreground">{formatPhoneCO(client.phone)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <a href={telLink(client.phone)}>
            <Phone className="size-4" />
            Llamar
          </a>
        </Button>
        <Button asChild variant="outline">
          <a
            href={whatsappLink(client.phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon className="size-4" />
            WhatsApp
          </a>
        </Button>
      </div>

      {client.email ? (
        <a
          href={`mailto:${client.email}`}
          className="text-muted-foreground flex items-center gap-2 text-sm hover:underline"
        >
          <Mail className="size-4 shrink-0" aria-hidden />
          {client.email}
        </a>
      ) : null}

      {/* Cumpleaños */}
      {client.birthdayDate ? (
        <div className="flex items-center gap-2 text-sm">
          <Cake className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="font-medium">
            {formatBirthday(client.birthdayDate)}
          </span>
          {/* Bono activo */}
          {activeBonus ? (
            <span className="ml-auto">
              {activeBonus.status === "pending_manicurist" && (
                <Link href="/cumpleanos">
                  <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-200">
                    🎂 Aprobar bono
                  </Badge>
                </Link>
              )}
              {activeBonus.status === "approved" && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  🎂 Esperando elección
                </Badge>
              )}
              {activeBonus.status === "chosen" && (
                <Badge className="bg-green-100 text-green-800">
                  🎂{" "}
                  {BIRTHDAY_OPTION_LABELS[
                    activeBonus.chosenOption as keyof typeof BIRTHDAY_OPTION_LABELS
                  ] ?? activeBonus.chosenOption}
                </Badge>
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {client.notes ? (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">Notas</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
            {client.notes}
          </p>
        </section>
      ) : null}

      <ClientDetailActions clientId={client.id} values={formValues} />

      <OptOutToggle clientId={client.id} initial={client.waOptOut} />

      {/* Totales */}
      {stats.count > 0 ? (
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border p-3">
            <p className="text-lg font-semibold">{stats.count}</p>
            <p className="text-muted-foreground text-xs">
              {stats.count === 1 ? "cita" : "citas"}
            </p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-lg font-semibold">
              {formatCOP(stats.totalPaidCop)}
            </p>
            <p className="text-muted-foreground text-xs">pagado</p>
          </div>
          <div className="rounded-xl border p-3">
            <p
              className={`text-lg font-semibold ${stats.outstandingCop > 0n ? "text-amber-700" : ""}`}
            >
              {formatCOP(stats.outstandingCop)}
            </p>
            <p className="text-muted-foreground text-xs">pendiente</p>
          </div>
        </section>
      ) : null}

      {/* Historial */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Historial de citas</h2>
          <Button asChild size="sm" variant="outline">
            <Link href={`/citas/nueva?cliente=${client.id}`}>
              <CalendarPlus className="size-4" />
              Nueva cita
            </Link>
          </Button>
        </div>

        {history.items.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-sm">
            <CalendarClock className="size-5 shrink-0" aria-hidden />
            <span>
              Sin citas todavía. Crea la primera con el botón &ldquo;Nueva
              cita&rdquo;.
            </span>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.items.map((appt) => {
              const services = appt.serviceSummary
                .map((s) =>
                  s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name,
                )
                .join(", ");
              return (
                <li key={appt.id}>
                  <Link
                    href={`/citas/${appt.id}`}
                    className="hover:bg-accent block rounded-xl border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatDateShort(appt.startsAt, tz)} ·{" "}
                          {formatTime(appt.startsAt, tz)}
                        </p>
                        {services ? (
                          <p className="text-muted-foreground truncate text-sm">
                            {services}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium">
                          {formatCOP(appt.totalCop)}
                        </p>
                        <Badge
                          className={`mt-1 ${paymentBadgeClass(appt.paymentStatus)}`}
                        >
                          {PAYMENT_LABEL[appt.paymentStatus] ??
                            appt.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {history.items.length > 0 && (page > 1 || history.hasMore) ? (
          <div className="flex justify-between pt-1">
            {page > 1 ? (
              <Link
                href={`/clientas/${client.id}?page=${page - 1}`}
                className="text-primary text-sm hover:underline"
              >
                ← Anteriores
              </Link>
            ) : (
              <span />
            )}
            {history.hasMore ? (
              <Link
                href={`/clientas/${client.id}?page=${page + 1}`}
                className="text-primary text-sm hover:underline"
              >
                Más antiguas →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
