import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  dayKeyDayNumber,
  formatDateShort,
  formatDayKeyLong,
  formatDayKeyWeekday,
  formatTime,
  shiftDayKey,
  tenantDayKey,
  tenantDayRangeUtc,
} from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  countByDayKey,
  daySummary,
  groupByDayKey,
} from "@/modules/appointments/agenda";
import { AgendaCard } from "@/modules/appointments/components/agenda-card";
import {
  type AgendaAppointment,
  hasScheduledInRange,
  listAppointmentsForAgenda,
} from "@/modules/appointments/repository";
import {
  countOverduePayments,
  pendingPayments,
} from "@/modules/finance/repository";
import { getTenantCached, requireTenant } from "@/modules/tenancy/context";
import { getTemplates } from "@/modules/whatsapp/repository";
import { buildWaLink, renderTemplate } from "@/modules/whatsapp/templates";

/**
 * Construye el mapa de enlaces wa.me de recordatorio para las citas agendadas
 * de mañana (QW-5). Reutiliza la plantilla `reminder` y el link público.
 */
async function buildReminderLinks(
  tenantId: string,
  tz: string,
  appts: AgendaAppointment[],
  dayLabel: string,
): Promise<Map<string, string>> {
  const scheduled = appts.filter((a) => a.status === "scheduled");
  if (scheduled.length === 0) return new Map();

  const [tenant, templates, headersList] = await Promise.all([
    getTenantCached(tenantId),
    getTemplates(tenantId),
    headers(),
  ]);
  const host = headersList.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const negocio = tenant?.name ?? "";

  return new Map(
    scheduled.map((a) => [
      a.id,
      buildWaLink(
        a.clientPhone,
        renderTemplate(templates.reminder, {
          clienta: a.clientName,
          negocio,
          fecha: dayLabel,
          hora: formatTime(a.startsAt, tz),
          servicios: a.serviceSummary
            .map((s) => (s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name))
            .join(", "),
          link: baseUrl ? `${baseUrl}/cita/${a.publicToken}` : "",
        }),
      ),
    ]),
  );
}

export const metadata: Metadata = { title: "Citas" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const tenant = await getTenantCached(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const sp = await searchParams;
  const view =
    sp.view === "semana"
      ? "semana"
      : sp.view === "proximas"
        ? "proximas"
        : sp.view === "pendientes"
          ? "pendientes"
          : "dia";
  const today = tenantDayKey(new Date(), tz);
  const tomorrow = shiftDayKey(today, 1);
  const selected =
    typeof sp.date === "string" && DATE_RE.test(sp.date) ? sp.date : today;

  // Badge en tab "Proximas": ¿hay citas mañana? EXISTS ligero en vez de cargar la
  // agenda completa de mañana solo para un booleano (B0.3).
  const { start: tmrStart, end: tmrEnd } = tenantDayRangeUtc(tomorrow, tz);
  const { start: todayStart } = tenantDayRangeUtc(today, tz);
  // Badge en tab "Pendientes" (D-29): citas por cobrar con antigüedad >= 1 día
  // calendario (TZ del tenant). Conteo liviano, en paralelo con el de mañana.
  const [hasTomorrow, overdueCount] = await Promise.all([
    hasScheduledInRange(tenantId, tmrStart, tmrEnd),
    countOverduePayments(tenantId, todayStart),
  ]);

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
        <Button asChild size="sm">
          <Link href="/citas/nueva">
            <Plus className="size-4" />
            Nueva
          </Link>
        </Button>
      </div>

      {/* Tabs Dia / Semana / Proximas / Pendientes */}
      <div className="bg-muted mb-4 grid grid-cols-4 gap-1 rounded-lg p-1">
        <Link
          href={`/citas?date=${selected}`}
          className={cn(
            "rounded-md py-1.5 text-center text-sm font-medium",
            view === "dia"
              ? "bg-background shadow-xs"
              : "text-muted-foreground",
          )}
        >
          Dia
        </Link>
        <Link
          href="/citas?view=semana"
          className={cn(
            "rounded-md py-1.5 text-center text-sm font-medium",
            view === "semana"
              ? "bg-background shadow-xs"
              : "text-muted-foreground",
          )}
        >
          Semana
        </Link>
        <Link
          href="/citas?view=proximas"
          className={cn(
            "relative rounded-md py-1.5 text-center text-sm font-medium",
            view === "proximas"
              ? "bg-background shadow-xs"
              : "text-muted-foreground",
          )}
        >
          Proximas
          {hasTomorrow && (
            <span
              className="absolute top-1.5 right-2 size-2 rounded-full bg-amber-500"
              aria-label="Hay citas manana"
            />
          )}
        </Link>
        <Link
          href="/citas?view=pendientes"
          className={cn(
            "relative rounded-md py-1.5 text-center text-sm font-medium",
            view === "pendientes"
              ? "bg-background shadow-xs"
              : "text-muted-foreground",
          )}
        >
          Pendientes
          {overdueCount > 0 && (
            <span
              aria-label={`${overdueCount} ${overdueCount === 1 ? "cita pendiente" : "citas pendientes"} de cobro`}
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
            >
              {overdueCount > 9 ? "9+" : overdueCount}
            </span>
          )}
        </Link>
      </div>

      {view === "proximas" ? (
        <ProximasView
          tenantId={tenantId}
          tz={tz}
          today={today}
          tomorrow={tomorrow}
        />
      ) : view === "semana" ? (
        <WeekView tenantId={tenantId} tz={tz} today={today} />
      ) : view === "pendientes" ? (
        <PendientesView tenantId={tenantId} tz={tz} todayStart={todayStart} />
      ) : (
        <DayView
          tenantId={tenantId}
          tz={tz}
          today={today}
          tomorrow={tomorrow}
          selected={selected}
        />
      )}

      <div className="pointer-events-none fixed bottom-0 left-1/2 z-40 mx-auto w-full max-w-md -translate-x-1/2">
        <div className="flex justify-end pr-4 pb-24">
          <Button
            asChild
            size="icon"
            aria-label="Nueva cita"
            className="pointer-events-auto size-14 rounded-full shadow-lg"
          >
            <Link href="/citas/nueva">
              <Plus className="size-6" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Vista Proximas ───────────────────────────────────────────────────────────

async function ProximasView({
  tenantId,
  tz,
  today,
  tomorrow,
}: {
  tenantId: string;
  tz: string;
  today: string;
  tomorrow: string;
}) {
  const { start } = tenantDayRangeUtc(today, tz);
  const { start: end } = tenantDayRangeUtc(shiftDayKey(today, 60), tz);
  const appts = await listAppointmentsForAgenda(tenantId, start, end);
  const scheduled = appts.filter((a) => a.status === "scheduled");
  const groups = groupByDayKey(scheduled, tz);

  if (scheduled.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin citas proximas"
        description="No tienes citas agendadas en los proximos 60 dias."
        action={
          <Button asChild size="sm">
            <Link href="/citas/nueva">Crear cita</Link>
          </Button>
        }
      />
    );
  }

  const sortedDays = [...groups.keys()].sort();

  return (
    <div className="space-y-5">
      {sortedDays.map((day) => {
        const items = groups.get(day) ?? [];
        const isToday = day === today;
        const isTomorrow = day === tomorrow;
        return (
          <section key={day} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium capitalize">
                {isToday
                  ? "Hoy — " + formatDayKeyLong(day)
                  : isTomorrow
                    ? "Manana — " + formatDayKeyLong(day)
                    : formatDayKeyLong(day)}
              </h2>
              {isTomorrow && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Manana
                </span>
              )}
            </div>
            {isTomorrow && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>⚠️</span>
                <span>
                  Tienes {items.length} {items.length === 1 ? "cita" : "citas"}{" "}
                  manana. Recuerda confirmar con tus clientas.
                </span>
              </div>
            )}
            <ul className="space-y-2">
              {items.map((appt) => (
                <li key={appt.id}>
                  <AgendaCard appt={appt} tz={tz} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ─── Vista Dia ────────────────────────────────────────────────────────────────

async function DayView({
  tenantId,
  tz,
  today,
  tomorrow,
  selected,
}: {
  tenantId: string;
  tz: string;
  today: string;
  tomorrow: string;
  selected: string;
}) {
  const stripStart = shiftDayKey(selected, -2);
  const stripDays = Array.from({ length: 7 }, (_, i) =>
    shiftDayKey(stripStart, i),
  );
  const rangeStart = tenantDayRangeUtc(stripStart, tz).start;
  const rangeEnd = tenantDayRangeUtc(shiftDayKey(stripStart, 7), tz).start;

  const appts = await listAppointmentsForAgenda(tenantId, rangeStart, rangeEnd);
  const counts = countByDayKey(appts, tz);
  const dayAppts = appts.filter(
    (a) => tenantDayKey(a.startsAt, tz) === selected,
  );
  const summary = daySummary(dayAppts);
  const isTomorrow = selected === tomorrow;

  // Recordatorios wa.me de un toque solo para las citas de mañana (QW-5).
  const reminderLinks = isTomorrow
    ? await buildReminderLinks(
        tenantId,
        tz,
        dayAppts,
        formatDayKeyLong(selected),
      )
    : new Map<string, string>();

  return (
    <div>
      {/* Alerta si el dia seleccionado es manana */}
      {isTomorrow && dayAppts.some((a) => a.status === "scheduled") && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>⚠️</span>
          <span>
            Estas son las citas de manana. Puedes enviar recordatorios por
            WhatsApp a tus clientas.
          </span>
        </div>
      )}

      {/* Header de navegacion */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Dia anterior">
          <Link href={`/citas?date=${shiftDayKey(selected, -1)}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="text-center">
          <p className="font-medium capitalize">{formatDayKeyLong(selected)}</p>
          {selected !== today ? (
            <Link
              href="/citas"
              className="text-primary text-xs hover:underline"
            >
              Volver a hoy
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">Hoy</span>
          )}
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Dia siguiente">
          <Link href={`/citas?date=${shiftDayKey(selected, 1)}`}>
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </div>

      {/* Tira de 7 dias */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {stripDays.map((day) => {
          const isSelected = day === selected;
          const count = counts.get(day) ?? 0;
          return (
            <Link
              key={day}
              href={`/citas?date=${day}`}
              className={cn(
                "flex min-w-12 flex-1 flex-col items-center rounded-lg border py-2",
                isSelected
                  ? "bg-brand-gradient border-transparent shadow-md"
                  : "border-transparent",
              )}
            >
              <span
                className={cn(
                  "text-xs capitalize",
                  isSelected ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {formatDayKeyWeekday(day)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isSelected
                    ? "text-white"
                    : day === today
                      ? "text-primary"
                      : "",
                )}
              >
                {dayKeyDayNumber(day)}
              </span>
              <span
                className={cn(
                  "mt-1 size-1.5 rounded-full",
                  count > 0
                    ? isSelected
                      ? "bg-white/60"
                      : "bg-primary"
                    : "bg-transparent",
                )}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>

      {/* Resumen del dia */}
      {summary.count > 0 ? (
        <p className="text-muted-foreground mb-3 text-sm">
          {summary.count} {summary.count === 1 ? "cita" : "citas"} &middot;{" "}
          {formatCOP(summary.totalCop)} total
          {summary.pendingCop > 0n
            ? ` · ${formatCOP(summary.pendingCop)} pendiente`
            : ""}
        </p>
      ) : null}

      {dayAppts.length > 0 ? (
        <ul className="space-y-2">
          {dayAppts.map((appt) => (
            <li key={appt.id}>
              <AgendaCard
                appt={appt}
                tz={tz}
                reminderHref={reminderLinks.get(appt.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Sin citas este dia"
          description="No tienes nada agendado. Toca + para crear una cita."
          action={
            <Button asChild size="sm">
              <Link href="/citas/nueva">Crear cita</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

// ─── Vista Semana ─────────────────────────────────────────────────────────────

async function WeekView({
  tenantId,
  tz,
  today,
}: {
  tenantId: string;
  tz: string;
  today: string;
}) {
  const rangeStart = tenantDayRangeUtc(today, tz).start;
  const rangeEnd = tenantDayRangeUtc(shiftDayKey(today, 7), tz).start;
  const appts = await listAppointmentsForAgenda(tenantId, rangeStart, rangeEnd);
  const groups = groupByDayKey(appts, tz);
  const days = Array.from({ length: 7 }, (_, i) => shiftDayKey(today, i));

  if (appts.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Semana sin citas"
        description="No tienes citas en los proximos 7 dias."
        action={
          <Button asChild size="sm">
            <Link href="/citas/nueva">Crear cita</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const items = groups.get(day) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-medium capitalize">
              {formatDayKeyLong(day)}
            </h2>
            <ul className="space-y-2">
              {items.map((appt) => (
                <li key={appt.id}>
                  <AgendaCard appt={appt} tz={tz} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ─── Vista Pendientes ─────────────────────────────────────────────────────────

/**
 * Citas pendientes de cobro (D-29/D-33): completadas o agendadas sin confirmar
 * por la clienta, con saldo > 0 y antigüedad
 * >= 1 día calendario (cambio de día en la TZ del tenant) — `todayStart` es el
 * inicio del día de hoy, así que solo entran citas de días anteriores. Reusa
 * `pendingPayments` (F6.B1) y el mismo patrón de cobranza por WhatsApp de
 * Finanzas.
 */
async function PendientesView({
  tenantId,
  tz,
  todayStart,
}: {
  tenantId: string;
  tz: string;
  todayStart: Date;
}) {
  const pending = await pendingPayments(tenantId, { before: todayStart });

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin citas pendientes de cobro"
        description="No tienes citas de dias anteriores con saldo pendiente."
      />
    );
  }

  const [tenant, templates] = await Promise.all([
    getTenantCached(tenantId),
    getTemplates(tenantId),
  ]);
  const negocio = tenant?.name ?? "";
  const total = pending.reduce((s, p) => s + p.saldo, 0n);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Citas pendientes de cobro</h2>
        <span className="text-destructive text-sm font-semibold">
          {formatCOP(total)}
        </span>
      </div>
      <ul className="divide-y rounded-xl border">
        {pending.map((p) => (
          <li
            key={p.appointmentId}
            className="hover:bg-accent flex items-center gap-1 pr-2"
          >
            <Link
              href={`/citas/${p.appointmentId}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {p.clientName}
                <span className="text-muted-foreground">
                  {" "}
                  ·{formatDateShort(p.startsAt, tz)}
                </span>
              </span>
              <span className="font-medium">{formatCOP(p.saldo)}</span>
            </Link>
            <a
              href={buildWaLink(
                p.clientPhone,
                renderTemplate(templates.payment_reminder, {
                  clienta: p.clientName,
                  negocio,
                  saldo: formatCOP(p.saldo),
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Cobrar a ${p.clientName} por WhatsApp`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-emerald-600"
            >
              <MessageCircle className="size-5" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
