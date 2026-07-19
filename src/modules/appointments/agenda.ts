import { tenantDayKey } from "@/lib/dates";

import { type PaymentStatus } from "./domain";

/**
 * Lógica pura de la agenda (sin DB). Agrupa citas por día en la TZ del tenant
 * y calcula el resumen del día (citas, total, pendiente). Las canceladas no
 * cuentan para los totales.
 */

type AgendaItem = {
  startsAt: Date;
  totalCop: bigint;
  paidCop: bigint;
  status: string;
};

/** Agrupa por clave de día (YYYY-MM-DD) en la TZ del tenant. */
export function groupByDayKey<T extends { startsAt: Date }>(
  items: T[],
  tz: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = tenantDayKey(item.startsAt, tz);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Conteo de citas por día (incluye canceladas) para la tira de días. */
export function countByDayKey(
  items: { startsAt: Date }[],
  tz: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = tenantDayKey(item.startsAt, tz);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export type DaySummary = {
  count: number;
  totalCop: bigint;
  pendingCop: bigint;
};

/** Resumen del día: nº de citas activas, total y pendiente (total - pagado). */
export function daySummary(items: AgendaItem[]): DaySummary {
  let count = 0;
  let totalCop = 0n;
  let pendingCop = 0n;
  for (const item of items) {
    if (item.status === "cancelled") continue;
    count += 1;
    totalCop += item.totalCop;
    const outstanding = item.totalCop - item.paidCop;
    if (outstanding > 0n) pendingCop += outstanding;
  }
  return { count, totalCop, pendingCop };
}

/** Color del badge según el estado de pago. */
export function paymentBadgeClass(status: PaymentStatus): string {
  switch (status) {
    case "paid":
      return "border-transparent bg-green-100 text-green-800";
    case "partial":
      return "border-transparent bg-blue-100 text-blue-800";
    default:
      return "border-transparent bg-amber-100 text-amber-800";
  }
}
