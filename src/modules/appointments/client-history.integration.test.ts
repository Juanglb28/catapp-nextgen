import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Historial y totales por clienta (F3.B5): orden descendente, paginación,
 * stats y aislamiento A/B. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("historial de citas por clienta (integración)", () => {
  let tenantA: string;
  let tenantB: string;
  let userAId: string;
  let clientAId: string;
  let svc1: string;

  async function createAt(iso: string) {
    const repo = await import("./repository");
    return repo.createAppointment(tenantA, {
      clientId: clientAId,
      startsAt: new Date(iso),
      endsAt: new Date(new Date(iso).getTime() + 3_600_000),
      services: [{ serviceId: svc1, priceCop: 30000n, quantity: 1 }],
    });
  }

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
    svc1 = (
      await servicesRepo.createService(tenantA, {
        name: "Manicure",
        basePriceCop: 30000n,
        durationMin: 45,
      })
    ).id;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("ordena descendente por inicio y pagina", async () => {
    const repo = await import("./repository");
    await createAt("2026-06-01T15:00:00Z");
    await createAt("2026-06-03T15:00:00Z");
    await createAt("2026-06-02T15:00:00Z");

    const p1 = await repo.listAppointmentsByClient(tenantA, clientAId, {
      page: 1,
      pageSize: 2,
    });
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    // Más reciente primero.
    expect(p1.items[0].startsAt.toISOString()).toBe("2026-06-03T15:00:00.000Z");
    expect(p1.items[1].startsAt.toISOString()).toBe("2026-06-02T15:00:00.000Z");

    const p2 = await repo.listAppointmentsByClient(tenantA, clientAId, {
      page: 2,
      pageSize: 2,
    });
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    expect(p2.items[0].startsAt.toISOString()).toBe("2026-06-01T15:00:00.000Z");
  });

  it("calcula los totales de la clienta (sin canceladas)", async () => {
    const repo = await import("./repository");
    const a1 = await createAt("2026-06-01T15:00:00Z"); // total 30000
    await repo.registerPayment(tenantA, a1.id, 10000n, userAId); // abono
    await createAt("2026-06-02T15:00:00Z"); // total 30000, sin pago
    const a3 = await createAt("2026-06-03T15:00:00Z");
    await repo.cancelAppointment(tenantA, a3.id, userAId); // cancelada -> excluida

    const stats = await repo.clientAppointmentStats(tenantA, clientAId);
    expect(stats.count).toBe(2);
    expect(stats.totalPaidCop).toBe(10000n);
    // pendiente: (30000-10000) + 30000 = 50000
    expect(stats.outstandingCop).toBe(50000n);
  });

  it("aislamiento: B no ve el historial ni los totales de la clienta de A", async () => {
    const repo = await import("./repository");
    await createAt("2026-06-01T15:00:00Z");

    const list = await repo.listAppointmentsByClient(tenantB, clientAId);
    expect(list.items).toHaveLength(0);

    const stats = await repo.clientAppointmentStats(tenantB, clientAId);
    expect(stats.count).toBe(0);
    expect(stats.totalPaidCop).toBe(0n);
  });
});
