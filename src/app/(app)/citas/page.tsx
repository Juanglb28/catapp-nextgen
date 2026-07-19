import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  dayKeyDayNumber,
  formatDayKeyLong,
  formatDayKeyWeekday,
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
  hasScheduledInRange,
  listAppointmentsForAgenda,
} from "@/modules/appointments/repository";
import { getTenantCached, requireTenant } from "@/modules/tenancy/context";

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
        : "dia";
  const today = tenantDayKey(new Date(), tz);
  const tomorrow = shiftDayKey(today, 1);
  const selected =
    typeof sp.date === "string" && DATE_RE.test(sp.date) ? sp.date : today;

  // Badge en tab "Proximas": ¿hay citas mañana? EXISTS ligero en vez de cargar la
  // agenda completa de mañana solo para un booleano (B0.3).
  const { start: tmrStart, end: tmrEnd } = tenantDayRangeUtc(tomorrow, tz);
  const hasTomorrow = await hasScheduledInRange(tenantId, tmrStart, tmrEnd);

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

      {/* Tabs Dia / Semana / Proximas */}
      <div className="bg-muted mb-4 grid grid-cols-3 gap-1 rounded-lg p-1">
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
              <AgendaCard appt={appt} tz={tz} />
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
