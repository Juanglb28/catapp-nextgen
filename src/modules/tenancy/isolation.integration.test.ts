import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  loadDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Aislamiento multi-tenant contra DB real (F1.B4).
 *
 * Garantía central de CatApp (D-02, D-11): un tenant JAMÁS ve datos de otro.
 * Estos tests crean dos negocios independientes y verifican que ninguna
 * consulta cruza la frontera del tenant. Requieren `TEST_DATABASE_URL`; sin
 * ella se saltan (CI/sandbox).
 */
describe.runIf(TEST_DB)("aislamiento multi-tenant (integración)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("cada usuario resuelve solo a SU tenant, nunca al del otro", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const tenantA = await seedTenantWithOwner(a.id, "Negocio A");
    const tenantB = await seedTenantWithOwner(b.id, "Negocio B");

    const { getUserTenant } = await import("@/modules/tenancy/repository");

    expect((await getUserTenant(a.id))?.tenantId).toBe(tenantA);
    expect((await getUserTenant(b.id))?.tenantId).toBe(tenantB);
    // La frontera nunca se cruza.
    expect((await getUserTenant(a.id))?.tenantId).not.toBe(tenantB);
    expect((await getUserTenant(b.id))?.tenantId).not.toBe(tenantA);
  });

  it("una consulta con alcance de tenant solo devuelve filas de ese tenant", async () => {
    // `memberships` es la primera tabla con `tenant_id`; sirve como caso
    // canónico del patrón de repositorios: filtrar por tenantId nunca trae
    // filas de otro tenant. Las fases siguientes reusan este arnés con sus
    // propias tablas (clients, services, appointments, ...).
    const a = await seedUser();
    const b = await seedUser();
    const tenantA = await seedTenantWithOwner(a.id, "A");
    await seedTenantWithOwner(b.id, "B");

    const { db } = await loadDb();
    const { memberships } = await import("@/modules/tenancy/schema");
    const { eq } = await import("drizzle-orm");

    const rowsA = await db
      .select()
      .from(memberships)
      .where(eq(memberships.tenantId, tenantA));

    expect(rowsA).toHaveLength(1);
    expect(rowsA.every((m) => m.tenantId === tenantA)).toBe(true);
    expect(rowsA[0].userId).toBe(a.id);
    // Ni el usuario ni la membership del tenant B aparecen.
    expect(rowsA.some((m) => m.userId === b.id)).toBe(false);
  });

  it("getTenant solo devuelve el tenant solicitado", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const tenantA = await seedTenantWithOwner(a.id, "Salón A");
    const tenantB = await seedTenantWithOwner(b.id, "Salón B");

    const { getTenant } = await import("@/modules/tenancy/repository");

    expect((await getTenant(tenantA))?.name).toBe("Salón A");
    expect((await getTenant(tenantB))?.name).toBe("Salón B");
    expect((await getTenant(tenantA))?.id).not.toBe(tenantB);
  });

  it("un usuario no puede tener dos membresías en el mismo tenant (unique)", async () => {
    const a = await seedUser();
    const tenantA = await seedTenantWithOwner(a.id, "A");

    const { db } = await loadDb();
    const { memberships } = await import("@/modules/tenancy/schema");

    await expect(
      db.insert(memberships).values({ userId: a.id, tenantId: tenantA }),
    ).rejects.toThrow();
  });
});
