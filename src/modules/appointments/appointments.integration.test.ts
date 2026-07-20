import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Repositorio de citas contra DB real (F3.B1): creación con servicios, recálculo
 * de total, override sticky, pagos parciales, auditoría, fronteras de día con TZ
 * y aislamiento A/B (D-02, D-11). Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("repositorio de citas (integración)", () => {
  let tenantA: string;
  let tenantB: string;
  let userAId: string;
  let clientAId: string;
  let svc1Id: string;
  let svc2Id: string;

  const at = (iso: string) => new Date(iso);

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    const b = await seedUser();
    userAId = a.id;
    tenantA = await seedTenantWithOwner(a.id, "Negocio A");
    tenantB = await seedTenantWithOwner(b.id, "Negocio B");

    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    clientAId = (
      await clientsRepo.createClient(tenantA, {
        name: "Ana",
        phone: "+573001112233",
        email: null,
        notes: null,
      })
    ).id;
    svc1Id = (
      await servicesRepo.createService(tenantA, {
        name: "Manicure",
        basePriceCop: 25000n,
        durationMin: 45,
      })
    ).id;
    svc2Id = (
      await servicesRepo.createService(tenantA, {
        name: "Pedicure",
        basePriceCop: 35000n,
        durationMin: 60,
      })
    ).id;
  });

  afterAll(async () => {
    await closeDb();
  });

  async function createBasic(overrides?: {
    services?: { serviceId: string; priceCop: bigint; quantity?: number }[];
    totalOverride?: bigint | null;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    const repo = await import("./repository");
    return repo.createAppointment(tenantA, {
      clientId: clientAId,
      startsAt: overrides?.startsAt ?? at("2026-06-12T15:00:00Z"),
      endsAt: overrides?.endsAt ?? at("2026-06-12T16:00:00Z"),
      services: overrides?.services ?? [
        { serviceId: svc1Id, priceCop: 25000n, quantity: 1 },
        { serviceId: svc2Id, priceCop: 35000n, quantity: 1 },
      ],
      totalOverride: overrides?.totalOverride,
    });
  }

  it("crea una cita con varios servicios y total = suma", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();
    expect(appt.totalCop).toBe(60000n);
    expect(appt.paymentStatus).toBe("pending");

    const details = await repo.getAppointment(tenantA, appt.id);
    expect(details?.services).toHaveLength(2);
    expect(details?.client.name).toBe("Ana");
    expect(details?.publicToken).toBeTruthy();
  });

  it("recalcula el total al cambiar los servicios", async () => {
    const repo = await import("./repository");
    const appt = await createBasic({
      services: [{ serviceId: svc1Id, priceCop: 25000n, quantity: 1 }],
    });
    expect(appt.totalCop).toBe(25000n);

    const updated = await repo.updateAppointment(
      tenantA,
      appt.id,
      { services: [{ serviceId: svc1Id, priceCop: 25000n, quantity: 2 }] },
      userAId,
    );
    expect(updated?.totalCop).toBe(50000n);
  });

  it("el override manual NO se pisa al editar otra cosa", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();

    const overridden = await repo.updateAppointment(
      tenantA,
      appt.id,
      { totalOverride: 99000n },
      userAId,
    );
    expect(overridden?.totalCop).toBe(99000n);

    const afterNotes = await repo.updateAppointment(
      tenantA,
      appt.id,
      { notes: "Pagó en efectivo" },
      userAId,
    );
    expect(afterNotes?.totalCop).toBe(99000n);
  });

  it("acumula pagos parciales y deriva el estado", async () => {
    const repo = await import("./repository");
    const appt = await createBasic(); // total 60000

    const p1 = await repo.registerPayment(tenantA, appt.id, 20000n, userAId);
    expect(p1?.paidCop).toBe(20000n);
    expect(p1?.paymentStatus).toBe("partial");

    const p2 = await repo.registerPayment(tenantA, appt.id, 40000n, userAId);
    expect(p2?.paidCop).toBe(60000n);
    expect(p2?.paymentStatus).toBe("paid");
  });

  it("pagos concurrentes no se pisan: FOR UPDATE serializa (B2.1, QA B1)", async () => {
    const repo = await import("./repository");
    const appt = await createBasic(); // total 60000

    // Dos pagos de 30000 a la vez. Con read-modify-write fuera de la tx uno se
    // perdía (paid=30000). Con FOR UPDATE dentro de la tx, se suman: paid=60000.
    await Promise.all([
      repo.registerPayment(tenantA, appt.id, 30000n, userAId),
      repo.registerPayment(tenantA, appt.id, 30000n, userAId),
    ]);

    const after = await repo.getAppointment(tenantA, appt.id);
    expect(after?.paidCop).toBe(60000n);
    expect(after?.paymentStatus).toBe("paid");

    // Y la auditoría registró las dos entradas de pago (ninguna se perdió).
    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    const paidChanges = history.filter((h) => h.field === "paid_cop");
    expect(paidChanges).toHaveLength(2);
  });

  it("setPaidAmount FIJA el monto exacto (corrige un pago duplicado)", async () => {
    const repo = await import("./repository");
    const appt = await createBasic(); // total 60000

    // Pago duplicado por error: 60000 + 60000 = 120000.
    await repo.registerPayment(tenantA, appt.id, 60000n, userAId);
    const dup = await repo.registerPayment(tenantA, appt.id, 60000n, userAId);
    expect(dup?.paidCop).toBe(120000n);

    // Corrección: fija el pagado al valor real, no suma.
    const fixed = await repo.setPaidAmount(tenantA, appt.id, 60000n, userAId);
    expect(fixed?.paidCop).toBe(60000n);
    expect(fixed?.paymentStatus).toBe("paid");

    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    const lastPaid = history.filter((h) => h.field === "paid_cop").at(-1);
    expect(lastPaid?.oldValue).toBe("120000");
    expect(lastPaid?.newValue).toBe("60000");
  });

  it("setPaidAmount no baja de 0 y deriva 'pending'", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();
    await repo.registerPayment(tenantA, appt.id, 60000n, userAId);

    const zeroed = await repo.setPaidAmount(tenantA, appt.id, -5000n, userAId);
    expect(zeroed?.paidCop).toBe(0n);
    expect(zeroed?.paymentStatus).toBe("pending");
  });

  it("setBonusDiscount descuenta del neto y recalcula el estado de pago", async () => {
    const repo = await import("./repository");
    const appt = await createBasic(); // total 60000

    // Bono de 60000 => neto 0 => la cita queda pagada aunque no haya abono.
    const withBonus = await repo.setBonusDiscount(
      tenantA,
      appt.id,
      60000n,
      userAId,
    );
    expect(withBonus?.bonusDiscountCop).toBe(60000n);
    expect(withBonus?.paymentStatus).toBe("paid");

    // Se topa al total: un bono mayor no deja el neto negativo.
    const capped = await repo.setBonusDiscount(
      tenantA,
      appt.id,
      999999n,
      userAId,
    );
    expect(capped?.bonusDiscountCop).toBe(60000n);

    // Quitar el bono restaura el neto y el estado vuelve a pendiente.
    const removed = await repo.setBonusDiscount(tenantA, appt.id, 0n, userAId);
    expect(removed?.bonusDiscountCop).toBe(0n);
    expect(removed?.paymentStatus).toBe("pending");

    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    expect(history.some((h) => h.field === "bonus_discount_cop")).toBe(true);
  });

  it("updatePaymentMethod cambia solo el método, sin tocar el monto", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();
    await repo.registerPayment(tenantA, appt.id, 60000n, userAId);

    const updated = await repo.updatePaymentMethod(
      tenantA,
      appt.id,
      "transferencia",
      userAId,
    );
    expect(updated?.paymentMethod).toBe("transferencia");
    expect(updated?.paidCop).toBe(60000n); // el monto NO se duplica

    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    const method = history.filter((h) => h.field === "payment_method");
    expect(method).toHaveLength(1);
    expect(method[0].newValue).toBe("transferencia");

    // Idempotente: marcar el mismo método no agrega auditoría ni cambia nada.
    await repo.updatePaymentMethod(tenantA, appt.id, "transferencia", userAId);
    const history2 = await repo.getAppointmentHistory(tenantA, appt.id);
    expect(history2.filter((h) => h.field === "payment_method")).toHaveLength(
      1,
    );
  });

  it("escribe UNA fila de auditoría por campo modificado (valores legibles)", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();

    await repo.updateAppointment(
      tenantA,
      appt.id,
      {
        notes: "Cambió de color",
        peopleCount: 2,
        services: [{ serviceId: svc1Id, priceCop: 50000n, quantity: 1 }],
      },
      userAId,
    );

    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    const byField = Object.fromEntries(history.map((h) => [h.field, h]));
    expect(Object.keys(byField).sort()).toEqual(
      ["notes", "people_count", "total_cop"].sort(),
    );
    expect(byField.total_cop.oldValue).toBe("60000");
    expect(byField.total_cop.newValue).toBe("50000");
    expect(byField.people_count.newValue).toBe("2");
    expect(history.every((h) => h.changedBy === userAId)).toBe(true);
  });

  it("ubica una cita de las 23:00 Bogotá en el día correcto", async () => {
    const repo = await import("./repository");
    // 2026-06-12 23:00 en Bogotá (UTC-5) = 2026-06-13 04:00 UTC
    const appt = await createBasic({
      startsAt: at("2026-06-13T04:00:00Z"),
      endsAt: at("2026-06-13T05:00:00Z"),
    });

    const day12 = await repo.listAppointmentsByDay(
      tenantA,
      "2026-06-12",
      "America/Bogota",
    );
    const day13 = await repo.listAppointmentsByDay(
      tenantA,
      "2026-06-13",
      "America/Bogota",
    );
    expect(day12.map((a) => a.id)).toContain(appt.id);
    expect(day13.map((a) => a.id)).not.toContain(appt.id);
  });

  it("cancela con auditoría de status", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();
    const cancelled = await repo.cancelAppointment(tenantA, appt.id, userAId);
    expect(cancelled?.status).toBe("cancelled");

    const history = await repo.getAppointmentHistory(tenantA, appt.id);
    expect(
      history.some((h) => h.field === "status" && h.newValue === "cancelled"),
    ).toBe(true);
  });

  // ---- Aislamiento A/B ----

  it("una cita de A no es visible ni mutable desde B", async () => {
    const repo = await import("./repository");
    const appt = await createBasic();

    expect(await repo.getAppointment(tenantB, appt.id)).toBeNull();
    expect(
      await repo.updateAppointment(tenantB, appt.id, { notes: "x" }, null),
    ).toBeNull();
    expect(await repo.registerPayment(tenantB, appt.id, 1000n)).toBeNull();
    expect(await repo.cancelAppointment(tenantB, appt.id)).toBeNull();
    expect(await repo.getAppointmentHistory(tenantB, appt.id)).toHaveLength(0);

    const day = await repo.listAppointmentsByDay(
      tenantB,
      "2026-06-12",
      "America/Bogota",
    );
    expect(day).toHaveLength(0);
  });

  it("no permite crear una cita con clienta de otro tenant", async () => {
    const repo = await import("./repository");
    await expect(
      repo.createAppointment(tenantB, {
        clientId: clientAId, // clienta del tenant A
        startsAt: at("2026-06-12T15:00:00Z"),
        endsAt: at("2026-06-12T16:00:00Z"),
        services: [],
      }),
    ).rejects.toThrow();
  });
});
