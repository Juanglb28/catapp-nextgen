"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/money";
import type { MonthlyReport } from "@/modules/finance/repository";

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground pt-3 pb-1 text-xs font-semibold tracking-wider uppercase">
        {title}
      </p>
      <div className="divide-y rounded-xl border px-3">{children}</div>
    </div>
  );
}

function formatDay(day: string): string {
  // day = 'YYYY-MM-DD'
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

export function MonthlyReportModal({
  trigger,
  report,
  monthLabel,
}: {
  trigger: ReactNode;
  report: MonthlyReport;
  monthLabel: string;
}) {
  const [open, setOpen] = useState(false);

  const totalCitas =
    report.citasCompletadas +
    report.citasCanceladas +
    report.citasNoShow +
    report.citasAgendadas;

  const totalCobrado =
    report.totalEfectivo + report.totalTransferencia + report.totalSinMetodo;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Informe — {monthLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 pb-4">
          {/* Resumen de citas */}
          <Section title="Citas">
            <Row label="Total de citas" value={totalCitas} />
            <Row
              label="Completadas"
              value={report.citasCompletadas}
              highlight
            />
            <Row label="Canceladas" value={report.citasCanceladas} />
            <Row label="No asistió" value={report.citasNoShow} />
            {report.citasAgendadas > 0 && (
              <Row
                label="Agendadas (pendientes)"
                value={report.citasAgendadas}
              />
            )}
          </Section>

          {/* Productividad */}
          <Section title="Productividad">
            <Row label="Días trabajados" value={report.diasTrabajados} />
            <Row
              label="Ingreso promedio diario"
              value={formatCOP(report.ingresoPromedioDiario)}
              highlight
            />
            {report.diaMasRentable && (
              <Row
                label="Día más rentable"
                value={
                  <span className="text-right">
                    <span className="block text-green-600 capitalize">
                      {formatDay(report.diaMasRentable.day)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatCOP(report.diaMasRentable.total)}
                    </span>
                  </span>
                }
              />
            )}
            {report.diaMenosRentable && (
              <Row
                label="Día menos rentable"
                value={
                  <span className="text-right">
                    <span className="block capitalize">
                      {formatDay(report.diaMenosRentable.day)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatCOP(report.diaMenosRentable.total)}
                    </span>
                  </span>
                }
              />
            )}
          </Section>

          {/* Ingresos */}
          <Section title="Ingresos">
            <Row
              label="Total cobrado"
              value={formatCOP(totalCobrado)}
              highlight
            />
            <Row label="Propinas" value={formatCOP(report.totalPropinas)} />
            <Row
              label="Total + propinas"
              value={formatCOP(totalCobrado + report.totalPropinas)}
              highlight
            />
          </Section>

          {/* Métodos de pago */}
          <Section title="Métodos de pago">
            <Row
              label="Efectivo"
              value={
                <span>
                  {formatCOP(report.totalEfectivo)}
                  {totalCobrado > 0n && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      (
                      {Math.round(
                        (Number(report.totalEfectivo) / Number(totalCobrado)) *
                          100,
                      )}
                      %)
                    </span>
                  )}
                </span>
              }
            />
            <Row
              label="Transferencia"
              value={
                <span>
                  {formatCOP(report.totalTransferencia)}
                  {totalCobrado > 0n && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      (
                      {Math.round(
                        (Number(report.totalTransferencia) /
                          Number(totalCobrado)) *
                          100,
                      )}
                      %)
                    </span>
                  )}
                </span>
              }
            />
            {report.totalSinMetodo > 0n && (
              <Row
                label="Sin método registrado"
                value={formatCOP(report.totalSinMetodo)}
              />
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
