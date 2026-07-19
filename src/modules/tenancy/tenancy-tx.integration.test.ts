import { afterAll, describe, expect, it } from "vitest";

// Integración de la transacción tenant+membership. Requiere TEST_DATABASE_URL
// con migraciones aplicadas. Se salta sin esa env (sandbox/CI). F1.B4 amplía el arnés.
const TEST_DB = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DB)("createTenantWithOwner (integración)", () => {
  it("hace rollback si la membership falla (no deja tenant huérfano)", async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { db } = await import("@/lib/db");
    const { tenants } = await import("@/modules/tenancy/schema");
    const { createTenantWithOwner } =
      await import("@/modules/tenancy/repository");
    const { sql } = await import("drizzle-orm");

    const before = await db.select({ n: sql<number>`count(*)` }).from(tenants);
    // userId inexistente -> viola el FK de memberships -> rollback de la tx
    await expect(
      createTenantWithOwner("user-que-no-existe", {
        name: "Rollback Test",
        phone: "+573001234567",
        timezone: "America/Bogota",
      }),
    ).rejects.toThrow();
    const after = await db.select({ n: sql<number>`count(*)` }).from(tenants);

    expect(Number(after[0].n)).toBe(Number(before[0].n));
  });

  afterAll(async () => {
    if (!TEST_DB) return;
    const { pool } = await import("@/lib/db");
    await pool.end();
  });
});
