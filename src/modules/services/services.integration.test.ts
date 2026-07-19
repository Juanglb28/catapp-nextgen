import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Repositorio de servicios contra DB real (F2.B2): CRUD + activar/desactivar +
 * aislamiento multi-tenant (D-02, D-11). Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("repositorio de servicios (integración)", () => {
  let tenantA: string;
  let tenantB: string;

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    const b = await seedUser();
    tenantA = await seedTenantWithOwner(a.id, "Negocio A");
    tenantB = await seedTenantWithOwner(b.id, "Negocio B");
  });

  afterAll(async () => {
    await closeDb();
  });

  it("crea y lista servicios activos (con precio bigint)", async () => {
    const repo = await import("./repository");
    await repo.createService(tenantA, {
      name: "Manicure",
      basePriceCop: 25000n,
      durationMin: 45,
    });
    const list = await repo.listServices(tenantA);
    expect(list).toHaveLength(1);
    expect(list[0].basePriceCop).toBe(25000n);
    expect(list[0].active).toBe(true);
  });

  it("desactiva y reactiva (no borra)", async () => {
    const repo = await import("./repository");
    const s = await repo.createService(tenantA, {
      name: "Pedicure",
      basePriceCop: 35000n,
      durationMin: 60,
    });

    await repo.deactivateService(tenantA, s.id);
    expect(await repo.listServices(tenantA)).toHaveLength(0);
    expect(
      await repo.listServices(tenantA, { includeInactive: true }),
    ).toHaveLength(1);

    await repo.activateService(tenantA, s.id);
    expect(await repo.listServices(tenantA)).toHaveLength(1);
  });

  it("createServices siembra varios de una vez", async () => {
    const repo = await import("./repository");
    await repo.createServices(tenantA, [
      { name: "A", basePriceCop: 1000n, durationMin: 30 },
      { name: "B", basePriceCop: 2000n, durationMin: 60 },
    ]);
    expect(await repo.listServices(tenantA)).toHaveLength(2);
  });

  // ---- Aislamiento A/B ----

  it("listar como A nunca devuelve servicios de B", async () => {
    const repo = await import("./repository");
    await repo.createService(tenantB, {
      name: "De B",
      basePriceCop: 9000n,
      durationMin: 30,
    });
    expect(
      await repo.listServices(tenantA, { includeInactive: true }),
    ).toHaveLength(0);
  });

  it("leer por id un servicio de B siendo A → null", async () => {
    const repo = await import("./repository");
    const sB = await repo.createService(tenantB, {
      name: "De B",
      basePriceCop: 9000n,
      durationMin: 30,
    });
    expect(await repo.getService(tenantA, sB.id)).toBeNull();
    expect((await repo.getService(tenantB, sB.id))?.id).toBe(sB.id);
  });

  it("mutar un servicio de B siendo A → no cambia la fila", async () => {
    const repo = await import("./repository");
    const sB = await repo.createService(tenantB, {
      name: "De B",
      basePriceCop: 9000n,
      durationMin: 30,
    });

    expect(
      await repo.updateService(tenantA, sB.id, {
        name: "Hackeado",
        basePriceCop: 1n,
        durationMin: 5,
      }),
    ).toBeNull();
    expect(await repo.deactivateService(tenantA, sB.id)).toBeNull();

    const still = await repo.getService(tenantB, sB.id);
    expect(still?.name).toBe("De B");
    expect(still?.active).toBe(true);
  });
});
