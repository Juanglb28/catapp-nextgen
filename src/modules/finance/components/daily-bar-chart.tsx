"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { formatCOP } from "@/lib/money";

/**
 * Gráfico de barras semanal (lunes a domingo) con:
 * - Tabs Ingresos / Propinas / Métodos de pago
 * - Navegación entre semanas (← →)
 * - 3 letras del día de semana debajo de cada barra (Lun/Mar/Mié/Jue/Vie/Sáb/Dom)
 * - Callout con el monto al tocar una barra
 * Mobile-first, SVG propio. F6.B2.
 */

// 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
const DOW3 = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

type Tab = "ingresos" | "propinas" | "metodos";

/** Devuelve el lunes de la semana que contiene `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}

export function DailyBarChart({
  points,
  year,
  month,
}: {
  points: {
    day: string;
    total: number;
    tip: number;
    efectivo: number;
    transferencia: number;
  }[];
  year: number;
  month: number;
}) {
  const [tab, setTab] = useState<Tab>("ingresos");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = semana del ancla, -1 = anterior…

  const byDay = new Map(points.map((p) => [p.day, p]));

  // Ancla: hoy si estamos en el mes actual, si no el último día del mes.
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const anchor = isCurrentMonth ? now : new Date(year, month - 1, daysInMonth);

  // Lunes de la semana base (semana del ancla) + offset
  const baseMonday = getMonday(anchor);
  const weekMonday = new Date(baseMonday);
  weekMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  // Los 7 días de la semana (lun→dom)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const p = byDay.get(key);
    return {
      n: d.getDate(),
      dow: DOW3[d.getDay()],
      total: p?.total ?? 0,
      tip: p?.tip ?? 0,
      efectivo: p?.efectivo ?? 0,
      transferencia: p?.transferencia ?? 0,
      inMonth: d.getFullYear() === year && d.getMonth() + 1 === month,
    };
  });

  // Navegación: no ir más allá del mes seleccionado
  const monthStart = new Date(year, month - 1, 1);
  const prevSunday = new Date(weekMonday);
  prevSunday.setDate(weekMonday.getDate() - 1);
  const canGoPrev = prevSunday >= monthStart;
  const canGoNext = weekOffset < 0;

  // SVG geometry — 7 barras con gap generoso
  const W = 360;
  const H = 120;
  const padBottom = 18; // un poco más para 3 letras
  const padTop = 2;
  const chartH = H - padBottom - padTop;
  const gap = 6;
  const barW = (W - gap * 6) / 7;

  function toggleBar(i: number) {
    setSelectedIdx((prev) => (prev === i ? null : i));
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedIdx(null);
  }

  function goWeek(delta: number) {
    setWeekOffset((o) => o + delta);
    setSelectedIdx(null);
  }

  // Valores y máximo según la pestaña activa
  const getBarValues = (d: (typeof weekDays)[0]) => {
    if (tab === "ingresos") return { main: d.total, alt: 0 };
    if (tab === "propinas") return { main: d.tip, alt: 0 };
    return { main: d.efectivo, alt: d.transferencia };
  };

  const allValues = weekDays.flatMap((d) => {
    const { main, alt } = getBarValues(d);
    return [main, alt];
  });
  const max = Math.max(1, ...allValues);

  const weekTotal = weekDays.reduce((s, d) => {
    const { main, alt } = getBarValues(d);
    return s + main + alt;
  }, 0);

  const selected = selectedIdx !== null ? weekDays[selectedIdx] : null;

  function calloutText(): string | null {
    if (selected === null || selectedIdx === null) return null;
    const { main, alt } = getBarValues(selected);
    const dow = selected.dow ?? "";
    if (tab === "metodos") {
      if (main === 0 && alt === 0) return `Sin pagos — ${dow}`;
      const parts: string[] = [];
      if (main > 0) parts.push(`Ef: ${formatCOP(BigInt(main))}`);
      if (alt > 0) parts.push(`Tr: ${formatCOP(BigInt(alt))}`);
      return `${parts.join(" · ")} — ${dow}`;
    }
    if (main === 0) return `Sin ${tab} — ${dow}`;
    return `${formatCOP(BigInt(main))} — ${dow}`;
  }

  function totalText(): string {
    if (weekTotal === 0) return "Sin datos esta semana";
    return `Total: ${formatCOP(BigInt(weekTotal))}`;
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b pb-2">
        {(["ingresos", "propinas", "metodos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "ingresos"
              ? "Ingresos"
              : t === "propinas"
                ? "Propinas"
                : "Métodos de pago"}
          </button>
        ))}
      </div>

      {/* Navegación de semana */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goWeek(-1)}
          disabled={!canGoPrev}
          aria-label="Semana anterior"
          className="text-muted-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-muted-foreground text-xs capitalize">
          {weekLabel(weekMonday)}
        </span>
        <button
          onClick={() => goWeek(1)}
          disabled={!canGoNext}
          aria-label="Semana siguiente"
          className="text-muted-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Leyenda métodos de pago */}
      {tab === "metodos" && (
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="bg-primary inline-block size-2.5 rounded-sm" />
            <span className="text-muted-foreground">Efectivo</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm bg-sky-500" />
            <span className="text-muted-foreground">Transferencia</span>
          </span>
        </div>
      )}

      {/* Callout */}
      <div className="flex h-5 items-center justify-end">
        {selectedIdx !== null ? (
          <span
            className={
              calloutText()?.startsWith("Sin")
                ? "text-muted-foreground text-xs"
                : "text-sm font-semibold"
            }
          >
            {calloutText()}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{totalText()}</span>
        )}
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full"
        role="img"
        aria-label={
          tab === "ingresos"
            ? "Ingresos por día"
            : tab === "propinas"
              ? "Propinas por día"
              : "Métodos de pago por día"
        }
      >
        {weekDays.map((d, i) => {
          const { main, alt } = getBarValues(d);
          const x = i * (barW + gap);
          const isSelected = i === selectedIdx;

          if (tab === "metodos") {
            // Dos barras delgadas por día (efectivo | transferencia)
            const halfW = (barW - 2) / 2;
            const hMain = main === 0 ? 0 : Math.max(3, (main / max) * chartH);
            const hAlt = alt === 0 ? 0 : Math.max(3, (alt / max) * chartH);
            const yMain = padTop + chartH - hMain;
            const yAlt = padTop + chartH - hAlt;
            const opacity = !d.inMonth ? 0.3 : isSelected ? 0.6 : 1;

            return (
              <g
                key={i}
                onClick={() => toggleBar(i)}
                style={{ cursor: "pointer", opacity }}
              >
                <rect
                  x={x}
                  y={padTop}
                  width={barW}
                  height={chartH}
                  fill="transparent"
                />
                {hMain > 0 && (
                  <rect
                    x={x}
                    y={yMain}
                    width={halfW}
                    height={hMain}
                    rx={2}
                    className="fill-primary"
                  />
                )}
                {hAlt > 0 && (
                  <rect
                    x={x + halfW + 2}
                    y={yAlt}
                    width={halfW}
                    height={hAlt}
                    rx={2}
                    className="fill-sky-500"
                  />
                )}
                <text
                  x={x + barW / 2}
                  y={H - 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  className={
                    d.inMonth
                      ? "fill-muted-foreground select-none"
                      : "fill-muted-foreground opacity-40 select-none"
                  }
                >
                  {d.dow}
                </text>
              </g>
            );
          }

          // Barra simple (ingresos / propinas)
          const h = main === 0 ? 0 : Math.max(3, (main / max) * chartH);
          const y = padTop + chartH - h;

          return (
            <g
              key={i}
              onClick={() => toggleBar(i)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={chartH}
                fill="transparent"
              />
              {h > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={2}
                  className={
                    isSelected
                      ? "fill-primary opacity-50"
                      : d.inMonth
                        ? "fill-primary"
                        : "fill-primary opacity-30"
                  }
                />
              )}
              <text
                x={x + barW / 2}
                y={H - 3}
                textAnchor="middle"
                fontSize="7.5"
                className={
                  d.inMonth
                    ? "fill-muted-foreground select-none"
                    : "fill-muted-foreground opacity-40 select-none"
                }
              >
                {d.dow}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
