import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Página pública por token (F4.B1): token válido resuelve solo datos públicos,
 * token inválido devuelve null, y la cancelada se identifica como tal (la página
 * la oculta). Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("getPublicAppointment (integración)", () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let svc1: string;

  async function createAppt() {
    const repo = await import("./repository");
    return repo.createAppointment(tenantId, {
      clientId,
      startsAt: new Date("2026-09-10T15:00:00Z"),
      endsAt: new Date("2026-09-10T16:00:00Z"),
      services: [{ serviceId: svc1, priceCop: 25000n, quantity: 2 }],
    });
  }

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    userId = a.id;
    tenantId = await seedTenantWithOwner(a.id, "Uñas de Susana");

    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    clientId = (
      await clientsRepo.createClient(tenantId, {
        name: "Ana María García",
        phone: "+573001112233",
        email: null,
        notes: null,
      })
    ).id;
    svc1 = (
      await servicesRepo.createService(tenantId, {
        name: "Manicure",
        basePriceCop: 25000n,
        durationMin: 45,
      })
    ).id;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("token válido devuelve solo datos públicos (sin precios ni teléfono)", async () => {
    const repo = await import("./repository");
    const appt = await createAppt();

    const pub = await repo.getPublicAppointment(appt.publicToken);
    expect(pub).not.toBeNull();
    expect(pub?.business.name).toBe("Uñas de Susana");
    expect(pub?.clientFirstName).toBe("Ana");
    expect(pub?.services).toEqual([{ name: "Manicure", quantity: 2 }]);
    // El DTO no incluye precios ni teléfono de la clienta.
    expect(JSON.stringify(pub)).not.toContain("25000");
    expect(JSON.stringify(pub)).not.toContain("573001112233");
  });

  it("incluye la dirección y nota públicas del negocio", async () => {
    const repo = await import("./repository");
    const tenancyRepo = await import("@/modules/tenancy/repository");
    await tenancyRepo.updateTenantPublicInfo(tenantId, {
      publicAddress: "Calle 1 #2-3",
      publicNote: "Llega 5 min antes",
    });
    const appt = await createAppt();
    const pub = await repo.getPublicAppointment(appt.publicToken);
    expect(pub?.business.publicAddress).toBe("Calle 1 #2-3");
    expect(pub?.business.publicNote).toBe("Llega 5 min antes");
  });

  it("token inexistente o malformado devuelve null", async () => {
    const repo = await import("./repository");
    expect(
      await repo.getPublicAppointment("11111111-1111-1111-1111-111111111111"),
    ).toBeNull();
    expect(await repo.getPublicAppointment("no-es-uuid")).toBeNull();
  });

  it("una cita cancelada se identifica como tal", async () => {
    const repo = await import("./repository");
    const appt = await createAppt();
    await repo.cancelAppointment(tenantId, appt.id, userId);
    const pub = await repo.getPublicAppointment(appt.publicToken);
    expect(pub?.status).toBe("cancelled");
  });

  it("reagendar incrementa el sequence (para que el .ics actualice)", async () => {
    const repo = await import("./repository");
    const appt = await createAppt();
    expect((await repo.getPublicAppointment(appt.publicToken))?.sequence).toBe(
      0,
    );

    await repo.updateAppointment(
      tenantId,
      appt.id,
      {
        startsAt: new Date("2026-09-11T15:00:00Z"),
        endsAt: new Date("2026-09-11T16:00:00Z"),
      },
      userId,
    );
    expect((await repo.getPublicAppointment(appt.publicToken))?.sequence).toBe(
      1,
    );
  });
});
