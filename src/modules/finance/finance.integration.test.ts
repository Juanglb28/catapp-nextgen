import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Capa financiera derivada de `appointments` (F6.B1). Dataset sembrado con
 * fronteras de mes en Bogotá, estados mezclados, pagos parciales, anticipos de
 * canceladas y aislamiento A/B; los totales se verifican contra el cálculo a
 * mano. También cubre el filtro `before` de "citas pendientes de cobro" (D-29)
 * reusando el mismo dataset. Requiere `TEST_DATABASE_URL`.
 */

const TZ = "America/Bogota";
const PRICE = 10000n;

describe.runIf(TEST_DB)("finanzas (integración)", () => {
  let tenantA: string;
  let tenantB: string;
  let ana: string;
  let bea: string;
  let svc: string;

  async function completed(
    tenantId: string,
    clientId: string,
    startsAt: Date,
    qty: number,
    paid: bigint,
  ) {
    const repo = await import("@/modules/appointments/repository");
    const appt = await repo.createAppointment(tenantId, {
      clientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      services: [{ serviceId: svc, priceCop: PRICE, quantity: qty }],
      status: "completed",
    });
    if (paid > 0n) await repo.registerPayment(tenantId, appt.id, paid);
    return appt;
  }

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    const b = await seedUser();
    tenantA = await seedTenantWithOwner(a.id, "Negocio A");
    tenantB = await seedTenantWithOwner(b.id, "Negocio B");

    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    ana = (
      await clientsRepo.createClient(tenantA, {
        name: "Ana",
        phone: "+573001110001",
        email: null,
        notes: null,
      })
    ).id;
    bea = (
      await clientsRepo.createClient(tenantA, {
        name: "Beatriz",
        phone: "+573001110002",
        email: null,
        notes: null,
      })
    ).id;
    svc = (
      await servicesRepo.createService(tenantA, {
        name: "Manicure",
        basePriceCop: PRICE,
        durationMin: 60,
      })
    ).id;

    const apptRepo = await import("@/modules/appointments/repository");

    // --- Julio 2026 (tenant A) ---
    // 1) Completada, Ana, 10 jul, 1×, pagada full (10000).
    await completed(tenantA, ana, new Date("2026-07-10T15:00:00Z"), 1, 10000n);
    // 2) Completada, Ana, 15 jul, 2× (20000), abono 5000 → saldo 15000.
    await completed(tenantA, ana, new Date("2026-07-15T15:00:00Z"), 2, 5000n);
    // 3) Completada, Beatriz, 31 jul 23:30 Bogotá (= 1 ago 04:30Z), 1×, sin pago.
    await completed(tenantA, bea, new Date("2026-08-01T04:30:00Z"), 1, 0n);
    // 4) Agendada futura, Ana, 20 jul → NO factura, NO "por cobrar".
    await apptRepo.createAppointment(tenantA, {
      clientId: ana,
      startsAt: new Date("2026-07-20T15:00:00Z"),
      endsAt: new Date("2026-07-20T16:00:00Z"),
      services: [{ serviceId: svc, priceCop: PRICE, quantity: 1 }],
    });
    // 5) Cancelada con anticipo 3000, Beatriz, 5 jul → "otros ingresos".
    const cancel = await apptRepo.createAppointment(tenantA, {
      clientId: bea,
      startsAt: new Date("2026-07-05T15:00:00Z"),
      endsAt: new Date("2026-07-05T16:00:00Z"),
      services: [{ serviceId: svc, priceCop: PRICE, quantity: 1 }],
    });
    await apptRepo.registerPayment(tenantA, cancel.id, 3000n);
    await apptRepo.cancelAppointment(tenantA, cancel.id);
    // 6) Completada en AGOSTO → fuera de julio.
    await completed(tenantA, ana, new Date("2026-08-02T15:00:00Z"), 1, 10000n);
    // 7) Completada en JUNIO con saldo 6000 → "por cobrar" de otra fecha.
    await completed(tenantA, ana, new Date("2026-06-25T15:00:00Z"), 1, 4000n);

    // --- Tenant B (aislamiento): completada en julio, total alto ---
    // La clienta debe pertenecer a B (createAppointment valida el tenant).
    const clientB = (
      await clientsRepo.createClient(tenantB, {
        name: "Clienta B",
        phone: "+573001110003",
        email: null,
        notes: null,
      })
    ).id;
    const svcB = (
      await servicesRepo.createService(tenantB, {
        name: "Manicure B",
        basePriceCop: PRICE,
        durationMin: 60,
      })
    ).id;
    await apptRepo.createAppointment(tenantB, {
      clientId: clientB,
      startsAt: new Date("2026-07-12T15:00:00Z"),
      endsAt: new Date("2026-07-12T16:00:00Z"),
      services: [{ serviceId: svcB, priceCop: PRICE, quantity: 9 }],
      status: "completed",
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  it("monthlySummary cuadra a mano (julio Bogotá)", async () => {
    const fin = await import("./repository");
    const s = await fin.monthlySummary(tenantA, 2026, 7, TZ);
    // Completadas julio: 10000 + 20000 + 10000 = 40000; cobrado 10000+5000+0.
    expect(s.totalFacturado).toBe(40000n);
    expect(s.totalCobrado).toBe(15000n);
    expect(s.totalPendiente).toBe(25000n);
    expect(s.citasCount).toBe(3);
    expect(s.otrosIngresos).toBe(3000n); // anticipo de la cancelada
  });

  it("la cita en la frontera (31 jul 23:30 Bogotá) cuenta en julio, no en agosto", async () => {
    const fin = await import("./repository");
    const jul = await fin.monthlySummary(tenantA, 2026, 7, TZ);
    const ago = await fin.monthlySummary(tenantA, 2026, 8, TZ);
    // Julio incluye la del 31; agosto solo la cita 6 (10000).
    expect(jul.citasCount).toBe(3);
    expect(ago.totalFacturado).toBe(10000n);
    const serie = await fin.dailySeries(tenantA, 2026, 7, TZ);
    expect(serie.map((p) => p.day)).toContain("2026-07-31");
    expect(serie.map((p) => p.day)).not.toContain("2026-08-01");
  });

  it("byService agrega cantidad y total del mes", async () => {
    const fin = await import("./repository");
    const rows = await fin.byService(tenantA, 2026, 7, TZ);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(4); // 1 + 2 + 1
    expect(rows[0].total).toBe(40000n);
  });

  it("byClient ordena por facturación desc", async () => {
    const fin = await import("./repository");
    const rows = await fin.byClient(tenantA, 2026, 7, TZ);
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beatriz"]);
    expect(rows[0].total).toBe(30000n); // Ana: 10000 + 20000
    expect(rows[0].citasCount).toBe(2);
    expect(rows[1].total).toBe(10000n);
  });

  it("pendingPayments: completadas con saldo, de cualquier fecha, más antigua primero", async () => {
    const fin = await import("./repository");
    const rows = await fin.pendingPayments(tenantA);
    // Junio (saldo 6000), 15 jul (15000), 31 jul (10000). Excluye futura y cancelada.
    expect(rows.map((r) => r.saldo)).toEqual([6000n, 15000n, 10000n]);
    expect(rows[0].startsAt.getTime()).toBeLessThan(rows[1].startsAt.getTime());
  });

  it("pendingPayments con `before` (D-29) solo incluye antigüedad previa al corte", async () => {
    const fin = await import("./repository");
    // Corte entre la del 15 jul (saldo 15000) y la del 31 jul/1 ago (saldo 10000):
    // deben quedar solo junio (6000) y 15 jul (15000).
    const cutoff = new Date("2026-07-20T00:00:00Z");
    const overdue = await fin.pendingPayments(tenantA, { before: cutoff });
    expect(overdue.map((p) => p.saldo)).toEqual([6000n, 15000n]);
    expect(overdue.every((p) => p.startsAt.getTime() < cutoff.getTime())).toBe(
      true,
    );

    // Sin `opts`, sigue trayendo las 3 (retrocompatible con Finanzas).
    const all = await fin.pendingPayments(tenantA);
    expect(all).toHaveLength(3);
  });

  it("countOverduePayments (D-29) cuenta lo mismo que pendingPayments con `before`, sin traer filas", async () => {
    const fin = await import("./repository");
    const cutoff = new Date("2026-07-20T00:00:00Z");
    const count = await fin.countOverduePayments(tenantA, cutoff);
    expect(count).toBe(2);

    // Con un corte muy lejano, cuenta las 3 pendientes (agendada y cancelada NO
    // se cuentan aunque su fecha sea anterior al corte).
    const far = new Date("2030-01-01T00:00:00Z");
    const countFar = await fin.countOverduePayments(tenantA, far);
    const all = await fin.pendingPayments(tenantA);
    expect(countFar).toBe(all.length);
  });

  it("aislamiento A/B: las cifras de B no aparecen en A", async () => {
    const fin = await import("./repository");
    const a = await fin.monthlySummary(tenantA, 2026, 7, TZ);
    const b = await fin.monthlySummary(tenantB, 2026, 7, TZ);
    expect(a.totalFacturado).toBe(40000n); // sin los 90000 de B
    expect(b.totalFacturado).toBe(90000n); // 9 × 10000
  });

  it("monthlyRows lista TODAS las citas del mes (cualquier estado) ordenadas", async () => {
    const fin = await import("./repository");
    const rows = await fin.monthlyRows(tenantA, 2026, 7, TZ);
    // Julio A: cancelada(5), completada(10), completada(15), agendada(20), completada(31).
    expect(rows).toHaveLength(5);
    expect(rows[0].clientName).toBe("Beatriz");
    expect(rows[0].status).toBe("cancelled");
    expect(rows[0].saldo).toBe(7000n); // 10000 − 3000 de anticipo
    expect(rows[4].status).toBe("completed"); // la del 31 jul (frontera)
    expect(rows.map((r) => r.servicesSummary)).toContain("Manicure ×2");
  });

  it("mes vacío devuelve ceros", async () => {
    const fin = await import("./repository");
    const s = await fin.monthlySummary(tenantA, 2026, 5, TZ);
    expect(s.totalFacturado).toBe(0n);
    expect(s.totalCobrado).toBe(0n);
    expect(s.totalPendiente).toBe(0n);
    expect(s.citasCount).toBe(0);
    expect(s.otrosIngresos).toBe(0n);
    expect(await fin.byService(tenantA, 2026, 5, TZ)).toEqual([]);
    expect(await fin.dailySeries(tenantA, 2026, 5, TZ)).toEqual([]);
  });
});
