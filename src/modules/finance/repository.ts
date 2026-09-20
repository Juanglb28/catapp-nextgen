import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

import { tenantMonthRangeUtc } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients } from "@/modules/clients/schema";
import type { AppointmentStatus } from "@/modules/appointments/domain";
import {
  appointmentServices,
  appointments,
} from "@/modules/appointments/schema";
import { services } from "@/modules/services/schema";
import { tenants } from "@/modules/tenancy/schema";

/**
 * Capa de datos financiera (F6.B1). Las finanzas se DERIVAN de `appointments`
 * (fuente de verdad única, D-08); no hay tablas espejo. Todas las agregaciones
 * se hacen en SQL (sum/count/group by), nunca trayendo filas a JS. Tenant-scoped
 * (D-11). Dinero en `bigint` COP. Las fronteras de mes se calculan en la TZ del
 * tenant (D-05).
 *
 * Regla de ingreso (D-14): una cita cuenta como facturación del mes de su
 * `starts_at` solo si `status = completed`. Las canceladas/no_show no facturan;
 * si tienen `paid_cop > 0` (anticipos no devueltos) van a "otros ingresos".
 */

export type MonthlySummary = {
  totalFacturado: bigint;
  totalCobrado: bigint;
  totalPendiente: bigint;
  citasCount: number;
  otrosIngresos: bigint;
};

export type ServiceBreakdownRow = {
  serviceId: string;
  name: string;
  quantity: number;
  total: bigint;
};

export type ClientBreakdownRow = {
  clientId: string;
  name: string;
  citasCount: number;
  total: bigint;
};

export type PendingPayment = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  startsAt: Date;
  total: bigint;
  paid: bigint;
  saldo: bigint;
};

export type DailyPoint = {
  day: string;
  total: bigint;
  tip: bigint;
  efectivo: bigint;
  transferencia: bigint;
};

export type MonthlyReport = {
  citasCompletadas: number;
  citasCanceladas: number;
  citasNoShow: number;
  citasAgendadas: number;
  diasTrabajados: number;
  diaMasRentable: { day: string; total: bigint } | null;
  diaMenosRentable: { day: string; total: bigint } | null;
  ingresoPromedioDiario: bigint;
  totalEfectivo: bigint;
  totalTransferencia: bigint;
  totalSinMetodo: bigint;
  totalPropinas: bigint;
};

/** Resumen del mes (facturado/cobrado/pendiente/conteo + otros ingresos). */
export async function monthlySummary(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
): Promise<MonthlySummary> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  const inMonth = and(
    eq(appointments.tenantId, tenantId),
    gte(appointments.startsAt, start),
    lt(appointments.startsAt, end),
  );

  const [completed] = await db
    .select({
      facturado: sql<string>`coalesce(sum(${appointments.totalCop} - ${appointments.bonusDiscountCop}), 0)`,
      cobrado: sql<string>`coalesce(sum(${appointments.paidCop}), 0)`,
      citas: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(and(inMonth, eq(appointments.status, "completed")));

  const [otros] = await db
    .select({
      total: sql<string>`coalesce(sum(${appointments.paidCop}), 0)`,
    })
    .from(appointments)
    .where(
      and(
        inMonth,
        inArray(appointments.status, ["cancelled", "no_show"]),
        sql`${appointments.paidCop} > 0`,
      ),
    );

  const totalFacturado = BigInt(completed.facturado);
  const totalCobrado = BigInt(completed.cobrado);
  return {
    totalFacturado,
    totalCobrado,
    totalPendiente: totalFacturado - totalCobrado,
    citasCount: completed.citas,
    otrosIngresos: BigInt(otros.total),
  };
}

/** Desglose por servicio del mes (cantidad y total a precio congelado). */
export async function byService(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
): Promise<ServiceBreakdownRow[]> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  const lineTotal = sql`sum(${appointmentServices.priceCop} * ${appointmentServices.quantity})`;
  const rows = await db
    .select({
      serviceId: services.id,
      name: services.name,
      quantity: sql<number>`sum(${appointmentServices.quantity})::int`,
      total: sql<string>`coalesce(${lineTotal}, 0)`,
    })
    .from(appointmentServices)
    .innerJoin(
      appointments,
      eq(appointments.id, appointmentServices.appointmentId),
    )
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "completed"),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .groupBy(services.id, services.name)
    .orderBy(desc(lineTotal));

  return rows.map((r) => ({
    serviceId: r.serviceId,
    name: r.name,
    quantity: r.quantity,
    total: BigInt(r.total),
  }));
}

/** Clientas por facturación del mes (desc). `limit` opcional para el "top N". */
export async function byClient(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
  limit?: number,
): Promise<ClientBreakdownRow[]> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  const total = sql`sum(${appointments.totalCop} - ${appointments.bonusDiscountCop})`;
  const q = db
    .select({
      clientId: clients.id,
      name: clients.name,
      citasCount: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(${total}, 0)`,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "completed"),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .groupBy(clients.id, clients.name)
    .orderBy(desc(total));

  const rows = await (limit ? q.limit(limit) : q);
  return rows.map((r) => ({
    clientId: r.clientId,
    name: r.name,
    citasCount: r.citasCount,
    total: BigInt(r.total),
  }));
}

/**
 * Estados que cuentan como "por cobrar con antigüedad" (D-29/D-33): las
 * completadas y también las agendadas que la clienta nunca confirmó
 * (`client_confirmation = pending`) — se atendió a la clienta pero la cita
 * nunca se cerró. Las agendadas confirmadas o rechazadas por la clienta NO
 * entran. Solo se aplica a las vistas de "atrasadas" (con `before`), no a
 * Finanzas, que factura únicamente completadas (D-14).
 */
const overdueStatusCondition = or(
  eq(appointments.status, "completed"),
  and(
    eq(appointments.status, "scheduled"),
    eq(appointments.clientConfirmation, "pending"),
  ),
);

/**
 * Citas COMPLETADAS con saldo pendiente (de cualquier fecha), de la más antigua
 * a la más reciente. Es la lista de "por cobrar": trabajo hecho sin pagar del
 * todo. No incluye futuras (scheduled) ni canceladas.
 *
 * `opts.before` (D-29): si se pasa, solo incluye citas con `starts_at` anterior
 * a esa fecha/hora y, además de las completadas, las agendadas sin confirmar
 * por la clienta (D-33). Lo usa la vista "Citas pendientes de cobro" (antigüedad
 * >= 1 día calendario, TZ del tenant) — el llamador pasa el inicio del día de
 * hoy en esa TZ.
 */
export async function pendingPayments(
  tenantId: string,
  opts?: { before?: Date },
): Promise<PendingPayment[]> {
  const rows = await db
    .select({
      appointmentId: appointments.id,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      startsAt: appointments.startsAt,
      total: appointments.totalCop,
      bonusDiscount: appointments.bonusDiscountCop,
      paid: appointments.paidCop,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        // Con `before` (vista de atrasadas, D-33) incluye agendadas sin confirmar.
        opts?.before
          ? overdueStatusCondition
          : eq(appointments.status, "completed"),
        sql`${appointments.totalCop} - ${appointments.bonusDiscountCop} > ${appointments.paidCop}`,
        opts?.before ? lt(appointments.startsAt, opts.before) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt));

  return rows.map((r) => ({
    appointmentId: r.appointmentId,
    clientId: r.clientId,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    startsAt: r.startsAt,
    total: r.total,
    paid: r.paid,
    // Saldo neto: descuenta el bono aplicado (coherente con el WHERE).
    saldo: r.total - r.bonusDiscount - r.paid,
  }));
}

/**
 * Cuenta citas pendientes de cobro con antigüedad >= 1 día calendario (D-29):
 * completadas o agendadas sin confirmar (D-33), con saldo > 0 y `starts_at` anterior a `before` (el llamador
 * pasa el inicio del día de hoy en la TZ del tenant). Se usa para la alerta /
 * badge global en la navegación — conteo liviano, sin traer filas.
 */
export async function countOverduePayments(
  tenantId: string,
  before: Date,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        overdueStatusCondition,
        sql`${appointments.totalCop} - ${appointments.bonusDiscountCop} > ${appointments.paidCop}`,
        lt(appointments.startsAt, before),
      ),
    );
  return row?.count ?? 0;
}

export type TenantOverduePayments = {
  tenantId: string;
  timezone: string;
  /** Citas por cobrar (completadas o agendadas sin confirmar) con antigüedad >= 1 día calendario (TZ del tenant). */
  count: number;
  /** Clienta de la cita más antigua (para el texto cuando count === 1). */
  oldestClientName: string;
  oldestStartsAt: Date;
};

/**
 * Consulta de SISTEMA (cross-tenant) para el cron de recordatorio de cobro
 * (D-32/D-33): tenants con al menos una cita completada —o agendada sin
 * confirmar por la clienta— con saldo pendiente cuya
 * fecha local (TZ de CADA tenant, R-D4) es anterior al día de hoy en esa TZ.
 * Misma definición de "pendiente de cobro" que `countOverduePayments` (D-29).
 */
export async function listTenantsWithOverduePayments(): Promise<
  TenantOverduePayments[]
> {
  const rows = await db
    .select({
      tenantId: appointments.tenantId,
      timezone: tenants.timezone,
      count: sql<number>`cast(count(*) as int)`,
      oldestClientName: sql<string>`(array_agg(${clients.name} order by ${appointments.startsAt} asc))[1]`,
      oldestStartsAt: sql<Date>`min(${appointments.startsAt})`,
    })
    .from(appointments)
    .innerJoin(tenants, eq(appointments.tenantId, tenants.id))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        overdueStatusCondition,
        sql`${appointments.totalCop} - ${appointments.bonusDiscountCop} > ${appointments.paidCop}`,
        sql`(${appointments.startsAt} at time zone ${tenants.timezone})::date < (now() at time zone ${tenants.timezone})::date`,
      ),
    )
    .groupBy(appointments.tenantId, tenants.timezone);

  return rows.map((r) => ({
    ...r,
    oldestStartsAt: new Date(r.oldestStartsAt),
  }));
}

/** Total facturado por día del mes (citas completadas), en la TZ del tenant. */
export async function dailySeries(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
): Promise<DailyPoint[]> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  // `tz` viene de la config del tenant (valor interno, nunca input del usuario).
  // Usamos sql.raw para que la expresión sea literal idéntica en SELECT, GROUP BY
  // y ORDER BY — si se parametriza ($1, $6, $7) PostgreSQL lanza error 42803
  // porque no puede probar que son el mismo valor.
  const tzLiteral = sql.raw(`'${tz}'`);
  const localDay = sql`(${appointments.startsAt} AT TIME ZONE ${tzLiteral})::date`;
  const rows = await db
    .select({
      day: sql<string>`to_char(${localDay}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${appointments.totalCop} - ${appointments.bonusDiscountCop}), 0)`,
      tip: sql<string>`coalesce(sum(${appointments.tipCop}), 0)`,
      // Desglose por método: si el pago tiene desglose (cash+transfer>0) usa esas
      // columnas (reparte los combinados); si no, cae al método único legado con
      // paid_cop (D-14/D-18).
      efectivo: sql<string>`coalesce(sum(case when (${appointments.cashCop} + ${appointments.transferCop}) > 0 then ${appointments.cashCop} when ${appointments.paymentMethod} = 'efectivo' then ${appointments.paidCop} else 0 end), 0)`,
      transferencia: sql<string>`coalesce(sum(case when (${appointments.cashCop} + ${appointments.transferCop}) > 0 then ${appointments.transferCop} when ${appointments.paymentMethod} = 'transferencia' then ${appointments.paidCop} else 0 end), 0)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "completed"),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .groupBy(localDay)
    .orderBy(localDay);

  return rows.map((r) => ({
    day: r.day,
    total: BigInt(r.total),
    tip: BigInt(r.tip),
    efectivo: BigInt(r.efectivo),
    transferencia: BigInt(r.transferencia),
  }));
}

export type MonthlyRow = {
  startsAt: Date;
  clientName: string;
  servicesSummary: string;
  total: bigint;
  paid: bigint;
  saldo: bigint;
  status: AppointmentStatus;
};

/**
 * Filas del mes (TODOS los estados) para el export CSV: una por cita, con el
 * resumen de servicios. Ordenadas por fecha. Tenant-scoped.
 */
export async function monthlyRows(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
): Promise<MonthlyRow[]> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  const appts = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      total: appointments.totalCop,
      paid: appointments.paidCop,
      clientName: clients.name,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .orderBy(asc(appointments.startsAt));

  if (appts.length === 0) return [];

  const lines = await db
    .select({
      appointmentId: appointmentServices.appointmentId,
      name: services.name,
      quantity: appointmentServices.quantity,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(
      inArray(
        appointmentServices.appointmentId,
        appts.map((a) => a.id),
      ),
    );

  const summaryByAppt = new Map<string, string[]>();
  for (const l of lines) {
    const label = l.quantity > 1 ? `${l.name} ×${l.quantity}` : l.name;
    const arr = summaryByAppt.get(l.appointmentId) ?? [];
    arr.push(label);
    summaryByAppt.set(l.appointmentId, arr);
  }

  return appts.map((a) => ({
    startsAt: a.startsAt,
    clientName: a.clientName,
    servicesSummary: (summaryByAppt.get(a.id) ?? []).join(", "),
    total: a.total,
    paid: a.paid,
    saldo: a.total - a.paid,
    status: a.status,
  }));
}

/**
 * Informe mensual completo: métricas de gestión para el modal de resumen.
 * Incluye conteo de citas por estado, días trabajados, día más/menos rentable,
 * promedio diario, totales por método de pago y propinas.
 */
export async function monthlyReport(
  tenantId: string,
  year: number,
  month: number,
  tz: string,
): Promise<MonthlyReport> {
  const { start, end } = tenantMonthRangeUtc(year, month, tz);
  const inMonth = and(
    eq(appointments.tenantId, tenantId),
    gte(appointments.startsAt, start),
    lt(appointments.startsAt, end),
  );

  // Conteo por estado
  const statusRows = await db
    .select({
      status: appointments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(inMonth)
    .groupBy(appointments.status);

  const byStatus = Object.fromEntries(
    statusRows.map((r) => [r.status, r.count]),
  );

  // Totales por método de pago (solo citas completadas)
  const [metodoPago] = await db
    .select({
      efectivo: sql<string>`coalesce(sum(case when (${appointments.cashCop} + ${appointments.transferCop}) > 0 then ${appointments.cashCop} when ${appointments.paymentMethod} = 'efectivo' then ${appointments.paidCop} else 0 end), 0)`,
      transferencia: sql<string>`coalesce(sum(case when (${appointments.cashCop} + ${appointments.transferCop}) > 0 then ${appointments.transferCop} when ${appointments.paymentMethod} = 'transferencia' then ${appointments.paidCop} else 0 end), 0)`,
      sinMetodo: sql<string>`coalesce(sum(case when (${appointments.cashCop} + ${appointments.transferCop}) > 0 then (${appointments.paidCop} - ${appointments.cashCop} - ${appointments.transferCop}) when ${appointments.paymentMethod} is null then ${appointments.paidCop} else 0 end), 0)`,
      propinas: sql<string>`coalesce(sum(${appointments.tipCop}), 0)`,
    })
    .from(appointments)
    .where(and(inMonth, eq(appointments.status, "completed")));

  // Días con citas completadas y sus totales (para mejor/peor día y promedio)
  const tzLiteral = sql.raw(`'${tz}'`);
  const localDay = sql`(${appointments.startsAt} AT TIME ZONE ${tzLiteral})::date`;
  const dayRows = await db
    .select({
      day: sql<string>`to_char(${localDay}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${appointments.totalCop} - ${appointments.bonusDiscountCop}), 0)`,
    })
    .from(appointments)
    .where(and(inMonth, eq(appointments.status, "completed")))
    .groupBy(localDay)
    .orderBy(localDay);

  const diasTrabajados = dayRows.length;
  const totalFacturado = dayRows.reduce((s, r) => s + BigInt(r.total), 0n);
  const ingresoPromedioDiario =
    diasTrabajados > 0 ? totalFacturado / BigInt(diasTrabajados) : 0n;

  const sorted = [...dayRows].sort((a, b) =>
    Number(BigInt(b.total) - BigInt(a.total)),
  );
  const diaMasRentable =
    sorted.length > 0 && BigInt(sorted[0]!.total) > 0n
      ? { day: sorted[0]!.day, total: BigInt(sorted[0]!.total) }
      : null;
  const diaMenosRentable =
    sorted.length > 1
      ? {
          day: sorted[sorted.length - 1]!.day,
          total: BigInt(sorted[sorted.length - 1]!.total),
        }
      : null;

  return {
    citasCompletadas: byStatus["completed"] ?? 0,
    citasCanceladas: byStatus["cancelled"] ?? 0,
    citasNoShow: byStatus["no_show"] ?? 0,
    citasAgendadas: byStatus["scheduled"] ?? 0,
    diasTrabajados,
    diaMasRentable,
    diaMenosRentable,
    ingresoPromedioDiario,
    totalEfectivo: BigInt(metodoPago?.efectivo ?? "0"),
    totalTransferencia: BigInt(metodoPago?.transferencia ?? "0"),
    totalSinMetodo: BigInt(metodoPago?.sinMetodo ?? "0"),
    totalPropinas: BigInt(metodoPago?.propinas ?? "0"),
  };
}
