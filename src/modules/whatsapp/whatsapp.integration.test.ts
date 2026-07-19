import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

import { DEFAULT_TEMPLATES } from "./templates";

/**
 * Plantillas de WhatsApp por tenant (F4.B2): defaults, personalización (upsert)
 * y aislamiento A/B. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("plantillas de WhatsApp (integración)", () => {
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

  it("sin overrides devuelve los textos por defecto", async () => {
    const repo = await import("./repository");
    const t = await repo.getTemplates(tenantA);
    expect(t.confirmation).toBe(DEFAULT_TEMPLATES.confirmation);
    expect(t.thankyou).toBe(DEFAULT_TEMPLATES.thankyou);
  });

  it("personaliza una plantilla y deja el resto en default", async () => {
    const repo = await import("./repository");
    await repo.upsertTemplate(tenantA, "confirmation", "Texto propio de A");
    const t = await repo.getTemplates(tenantA);
    expect(t.confirmation).toBe("Texto propio de A");
    expect(t.reminder).toBe(DEFAULT_TEMPLATES.reminder);
  });

  it("upsert actualiza el texto existente (no duplica)", async () => {
    const repo = await import("./repository");
    await repo.upsertTemplate(tenantA, "confirmation", "v1");
    await repo.upsertTemplate(tenantA, "confirmation", "v2");
    const t = await repo.getTemplates(tenantA);
    expect(t.confirmation).toBe("v2");
  });

  it("aislamiento: la personalización de A no afecta a B", async () => {
    const repo = await import("./repository");
    await repo.upsertTemplate(tenantA, "confirmation", "Solo de A");
    const tB = await repo.getTemplates(tenantB);
    expect(tB.confirmation).toBe(DEFAULT_TEMPLATES.confirmation);
  });
});
