import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Repositorio de clientas contra DB real (F2.B1): CRUD + búsqueda + aislamiento
 * multi-tenant (D-02, D-11). Requiere `TEST_DATABASE_URL`; sin ella se salta.
 */
describe.runIf(TEST_DB)("repositorio de clientas (integración)", () => {
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

  it("crea y lista clientas activas del tenant", async () => {
    const repo = await import("./repository");
    await repo.createClient(tenantA, {
      name: "Ana",
      phone: "+573001112233",
      email: null,
      notes: null,
    });
    const list = await repo.listClients(tenantA);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Ana");
  });

  it("busca por nombre y por teléfono", async () => {
    const repo = await import("./repository");
    await repo.createClient(tenantA, {
      name: "Ana López",
      phone: "+573001112233",
      email: null,
      notes: null,
    });
    await repo.createClient(tenantA, {
      name: "Beatriz Ruiz",
      phone: "+573004445566",
      email: null,
      notes: null,
    });

    expect(await repo.listClients(tenantA, { search: "ana" })).toHaveLength(1);
    expect(await repo.listClients(tenantA, { search: "4445" })).toHaveLength(1);
    expect(await repo.listClients(tenantA, { search: "zzz" })).toHaveLength(0);
  });

  it("archiva (soft delete) y restaura", async () => {
    const repo = await import("./repository");
    const c = await repo.createClient(tenantA, {
      name: "Ana",
      phone: "+573001112233",
      email: null,
      notes: null,
    });

    await repo.archiveClient(tenantA, c.id);
    expect(await repo.listClients(tenantA)).toHaveLength(0);
    expect(await repo.listArchivedClients(tenantA)).toHaveLength(1);

    await repo.restoreClient(tenantA, c.id);
    expect(await repo.listClients(tenantA)).toHaveLength(1);
    expect(await repo.listArchivedClients(tenantA)).toHaveLength(0);
  });

  it("actualiza una clienta del propio tenant", async () => {
    const repo = await import("./repository");
    const c = await repo.createClient(tenantA, {
      name: "Ana",
      phone: "+573001112233",
      email: null,
      notes: null,
    });
    const updated = await repo.updateClient(tenantA, c.id, {
      name: "Ana María",
      phone: "+573001112233",
      email: "ana@correo.com",
      notes: "Alérgica al acrílico",
    });
    expect(updated?.name).toBe("Ana María");
    expect(updated?.email).toBe("ana@correo.com");
  });

  // ---- Aislamiento A/B (la frontera del tenant nunca se cruza) ----

  it("listar como A nunca devuelve clientas de B", async () => {
    const repo = await import("./repository");
    await repo.createClient(tenantB, {
      name: "Clienta de B",
      phone: "+573009998877",
      email: null,
      notes: null,
    });
    expect(await repo.listClients(tenantA)).toHaveLength(0);
  });

  it("leer por id un recurso de B siendo A → null", async () => {
    const repo = await import("./repository");
    const cB = await repo.createClient(tenantB, {
      name: "Clienta de B",
      phone: "+573009998877",
      email: null,
      notes: null,
    });
    expect(await repo.getClient(tenantA, cB.id)).toBeNull();
    // B sí la ve.
    expect((await repo.getClient(tenantB, cB.id))?.id).toBe(cB.id);
  });

  it("mutar un recurso de B siendo A → no cambia la fila", async () => {
    const repo = await import("./repository");
    const cB = await repo.createClient(tenantB, {
      name: "Clienta de B",
      phone: "+573009998877",
      email: null,
      notes: null,
    });

    const updated = await repo.updateClient(tenantA, cB.id, {
      name: "Hackeada",
      phone: "+573000000000",
      email: null,
      notes: null,
    });
    expect(updated).toBeNull();

    const archived = await repo.archiveClient(tenantA, cB.id);
    expect(archived).toBeNull();

    // La fila de B sigue intacta y activa.
    const still = await repo.getClient(tenantB, cB.id);
    expect(still?.name).toBe("Clienta de B");
    expect(still?.archivedAt).toBeNull();
  });
});
