import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

import { movementDelta } from "./domain";

/**
 * Inventario (F7.B1): el stock solo cambia vía movimientos, con guarda atómica
 * (no negativo) incluso bajo concurrencia, y la suma de movimientos == stock.
 * Aislamiento A/B. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("inventario (integración)", () => {
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

  it("createProduct con stock inicial deja un movimiento 'in'", async () => {
    const repo = await import("./repository");
    const p = await repo.createProduct(tenantA, {
      name: "Esmalte rojo",
      unit: "ml",
      minStock: 2,
      initialStock: 10,
    });
    expect(p.stock).toBe(10);
    const { items } = await repo.listMovements(tenantA, p.id);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("in");
    expect(Number(items[0].quantity)).toBe(10);
  });

  it("salidas reducen el stock; salida mayor al stock falla", async () => {
    const repo = await import("./repository");
    const p = await repo.createProduct(tenantA, { name: "X", initialStock: 5 });

    const afterOut = await repo.registerMovement(tenantA, p.id, {
      type: "out",
      quantity: 3,
    });
    expect(afterOut.stock).toBe(2);

    await expect(
      repo.registerMovement(tenantA, p.id, { type: "out", quantity: 5 }),
    ).rejects.toThrow(/insuficiente/i);
    // El stock no cambió tras el fallo.
    expect((await repo.getProduct(tenantA, p.id))?.stock).toBe(2);
  });

  it("ajuste con delta positivo y negativo", async () => {
    const repo = await import("./repository");
    const p = await repo.createProduct(tenantA, { name: "X", initialStock: 4 });
    await repo.registerMovement(tenantA, p.id, { type: "adjust", quantity: 3 });
    expect((await repo.getProduct(tenantA, p.id))?.stock).toBe(7);
    await repo.registerMovement(tenantA, p.id, {
      type: "adjust",
      quantity: -5,
    });
    expect((await repo.getProduct(tenantA, p.id))?.stock).toBe(2);
  });

  it("la suma de movimientos es igual al stock actual", async () => {
    const repo = await import("./repository");
    const p = await repo.createProduct(tenantA, { name: "X", initialStock: 8 });
    await repo.registerMovement(tenantA, p.id, { type: "out", quantity: 3 });
    await repo.registerMovement(tenantA, p.id, { type: "in", quantity: 2 });
    await repo.registerMovement(tenantA, p.id, {
      type: "adjust",
      quantity: -1,
    });

    const { items } = await repo.listMovements(tenantA, p.id, { limit: 100 });
    const suma = items.reduce(
      (acc, m) => acc + movementDelta(m.type, Number(m.quantity)),
      0,
    );
    const stock = (await repo.getProduct(tenantA, p.id))?.stock;
    expect(suma).toBe(stock);
    expect(stock).toBe(6); // 8 − 3 + 2 − 1
  });

  it("concurrencia: dos salidas simultáneas no dejan stock negativo", async () => {
    const repo = await import("./repository");
    const p = await repo.createProduct(tenantA, { name: "X", initialStock: 1 });

    const results = await Promise.allSettled([
      repo.registerMovement(tenantA, p.id, { type: "out", quantity: 1 }),
      repo.registerMovement(tenantA, p.id, { type: "out", quantity: 1 }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);
    expect((await repo.getProduct(tenantA, p.id))?.stock).toBe(0);
  });

  it("stock bajo: filtro, conteo y aislamiento A/B", async () => {
    const repo = await import("./repository");
    // A: uno bajo (stock 1, min 3) y uno ok (stock 10, min 2).
    const bajo = await repo.createProduct(tenantA, {
      name: "Bajo",
      minStock: 3,
      initialStock: 1,
    });
    await repo.createProduct(tenantA, {
      name: "OK",
      minStock: 2,
      initialStock: 10,
    });
    // B: su propio producto bajo (no debe contar para A).
    await repo.createProduct(tenantB, {
      name: "B-bajo",
      minStock: 5,
      initialStock: 0,
    });

    expect(await repo.lowStockCount(tenantA)).toBe(1);
    expect(await repo.lowStockCount(tenantB)).toBe(1);

    const soloBajos = await repo.listProducts(tenantA, { lowStockOnly: true });
    expect(soloBajos.map((p) => p.id)).toEqual([bajo.id]);
    expect(soloBajos[0].lowStock).toBe(true);

    // A no ve productos de B.
    const all = await repo.listProducts(tenantA);
    expect(all).toHaveLength(2);
  });
});
