import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatDateShort, tenantDayKey } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { DailyBarChart } from "@/modules/finance/components/daily-bar-chart";
import { MonthlyReportModal } from "@/modules/finance/components/monthly-report-modal";
import {
  byClient,
  byService,
  dailySeries,
  monthlyReport,
  monthlySummary,
  pendingPayments,
} from "@/modules/finance/repository";
import { ProductList } from "@/modules/inventory/components/product-list";
import { listProducts } from "@/modules/inventory/repository";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import { getTemplates } from "@/modules/whatsapp/repository";
import { buildWaLink, renderTemplate } from "@/modules/whatsapp/templates";

export const metadata: Metadata = { title: "Finanzas" };
export const dynamic = "force-dynamic";

/** Suma `delta` meses a (year, month con month 1–12). */
function addMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const [cy, cm] = tenantDayKey(new Date(), tz).split("-").map(Number);
  const sp = await searchParams;
  let year = Number(sp.year);
  let month = Number(sp.month);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    year = cy;
    month = cm;
  }
  // No permitir meses futuros más allá del corriente.
  if (year * 12 + month > cy * 12 + cm) {
    year = cy;
    month = cm;
  }

  const prev = addMonth(year, month, -1);
  const next = addMonth(year, month, 1);
  const atCurrent = year * 12 + month >= cy * 12 + cm;

  const [
    summary,
    prevSummary,
    services,
    clientsTop,
    pending,
    series,
    report,
    inventoryProducts,
  ] = await Promise.all([
    monthlySummary(tenantId, year, month, tz),
    monthlySummary(tenantId, prev.year, prev.month, tz),
    byService(tenantId, year, month, tz),
    byClient(tenantId, year, month, tz, 5),
    pendingPayments(tenantId),
    dailySeries(tenantId, year, month, tz),
    monthlyReport(tenantId, year, month, tz),
    listProducts(tenantId),
  ]);

  const pendingTotal = pending.reduce((s, p) => s + p.saldo, 0n);

  // Cobranza de un toque (QW-6): wa.me por deudora con la plantilla de pago.
  const templates = await getTemplates(tenantId);
  const businessName = tenant?.name ?? "";
  const paymentLinks = new Map(
    pending.map((p) => [
      p.appointmentId,
      buildWaLink(
        p.clientPhone,
        renderTemplate(templates.payment_reminder, {
          clienta: p.clientName,
          negocio: businessName,
          saldo: formatCOP(p.saldo),
        }),
      ),
    ]),
  );
  const deltaPct =
    prevSummary.totalFacturado > 0n
      ? Number(
          ((summary.totalFacturado - prevSummary.totalFacturado) * 100n) /
            prevSummary.totalFacturado,
        )
      : null;

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>

      {/* Selector de mes */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" aria-label="Mes anterior">
          <Link href={`/finanzas?year=${prev.year}&month=${prev.month}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <p className="text-sm font-medium capitalize">
          {monthLabel(year, month)}
        </p>
        {atCurrent ? (
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-5" />
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Mes siguiente"
          >
            <Link href={`/finanzas?year=${next.year}&month=${next.month}`}>
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        )}
      </div>

      {/* Tarjeta protagonista: total del mes (abre informe mensual al tocar) */}
      <MonthlyReportModal
        report={report}
        monthLabel={monthLabel(year, month)}
        trigger={
          <button
            type="button"
            className="bg-brand-gradient-deep relative w-full cursor-pointer overflow-hidden rounded-2xl p-5 text-left text-white transition-opacity active:opacity-90"
            aria-label="Ver informe mensual"
          >
            {/* círculos decorativos */}
            <div
              className="absolute -top-8 -right-8 size-28 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-hidden
            />
            <div
              className="absolute -bottom-5 left-5 size-20 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }}
              aria-hidden
            />
            <p className="text-xs font-semibold tracking-wider uppercase opacity-75">
              Total del mes
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {formatCOP(summary.totalFacturado)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="opacity-60">
                {summary.citasCount}{" "}
                {summary.citasCount === 1 ? "cita" : "citas"} completadas
              </span>
              {deltaPct !== null ? (
                <span className="flex items-center gap-0.5 font-semibold text-white/90">
                  {deltaPct >= 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {Math.abs(deltaPct)}% vs mes anterior
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs opacity-50">
              Toca para ver informe completo →
            </p>
          </button>
        }
      />

      {/* Cobrado / Pendiente */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">Cobrado</p>
          <p className="text-lg font-semibold text-green-600">
            {formatCOP(summary.totalCobrado)}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">Pendiente del mes</p>
          <p className="text-lg font-semibold">
            {formatCOP(summary.totalPendiente)}
          </p>
        </div>
      </div>

      {summary.otrosIngresos > 0n ? (
        <p className="text-muted-foreground text-sm">
          Otros ingresos (anticipos de citas canceladas):{" "}
          <span className="font-medium">
            {formatCOP(summary.otrosIngresos)}
          </span>
        </p>
      ) : null}

      {/* Gráfico por día */}
      <DailyBarChart
        points={series.map((p) => ({
          day: p.day,
          total: Number(p.total),
          tip: Number(p.tip),
          efectivo: Number(p.efectivo),
          transferencia: Number(p.transferencia),
        }))}
        year={year}
        month={month}
      />

      {/* Desglose por servicio */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Por servicio</h2>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Sin servicios este mes.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {services.map((s) => (
              <li
                key={s.serviceId}
                className="flex items-center justify-between px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {s.name}
                  <span className="text-muted-foreground"> ·×{s.quantity}</span>
                </span>
                <span className="font-medium">{formatCOP(s.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top clientas */}
      {clientsTop.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Top clientas</h2>
          <ul className="divide-y rounded-xl border">
            {clientsTop.map((c) => (
              <li
                key={c.clientId}
                className="flex items-center justify-between px-3 py-2.5 text-sm"
              >
                <Link
                  href={`/clientas/${c.clientId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {c.name}
                  <span className="text-muted-foreground">
                    {" "}
                    ·{c.citasCount} {c.citasCount === 1 ? "cita" : "citas"}
                  </span>
                </Link>
                <span className="font-medium">{formatCOP(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Pagos pendientes (todas las fechas) */}
      {pending.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Pagos pendientes</h2>
            <span className="text-destructive text-sm font-semibold">
              {formatCOP(pendingTotal)}
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
                  href={paymentLinks.get(p.appointmentId)}
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
      ) : null}

      {/* Export CSV */}
      <Button asChild variant="outline" className="w-full">
        <a href={`/api/finanzas/export?year=${year}&month=${month}`}>
          <Download className="size-4" />
          Descargar CSV del mes
        </a>
      </Button>

      {/* Inventario */}
      <div className="border-t pt-4">
        <ProductList products={inventoryProducts} />
      </div>
    </div>
  );
}
