import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/tenancy/context", () => ({ requireTenant: vi.fn() }));

import { requireTenant } from "@/modules/tenancy/context";

import { createAppointmentAction, editAppointmentAction } from "./actions";

const requireTenantMock = vi.mocked(requireTenant);

/**
 * Server Action de creación de cita contra DB real (F3.B2): happy path,
 * precios congelados, advertencia de solape (no bloqueante) y clienta recién
 * creada. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("createAppointmentAction (integración)", () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let svc1: string;
  let svc2: string;

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    userId = a.id;
    tenantId = await seedTenantWithOwner(a.id, "Negocio A");
    requireTenantMock.mockResolvedValue({ tenantId, userId });

    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    clientId = (
      await clientsRepo.createClient(tenantId, {
        name: "Ana",
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
    svc2 = (
      await servicesRepo.createService(tenantId, {
        name: "Pedicure",
        basePriceCop: 35000n,
        durationMin: 60,
      })
    ).id;
  });

  afterAll(async () => {
    await closeDb();
  });

  const basePayload = () => ({
    clientId,
    services: [
      { serviceId: svc1, quantity: 1 },
      { serviceId: svc2, quantity: 1 },
    ],
    date: "2026-09-10",
    time: "10:00",
    durationMin: 60,
    totalOverride: null as number | null,
    peopleCount: 1,
    notes: "",
    payment: { kind: "pending" as const, amount: 0 },
    force: false,
  });

  it("crea la cita con precios congelados del catálogo", async () => {
    const result = await createAppointmentAction(basePayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const repo = await import("./repository");
    const appt = await repo.getAppointment(tenantId, result.id);
    expect(appt?.totalCop).toBe(60000n);
    expect(appt?.services).toHaveLength(2);
  });

  it("registra el pago completo cuando es 'pagada'", async () => {
    const result = await createAppointmentAction({
      ...basePayload(),
      payment: { kind: "paid", amount: 0 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const repo = await import("./repository");
    const appt = await repo.getAppointment(tenantId, result.id);
    expect(appt?.paidCop).toBe(60000n);
    expect(appt?.paymentStatus).toBe("paid");
  });

  it("advierte de solape (no bloquea) y permite forzar", async () => {
    const first = await createAppointmentAction(basePayload());
    expect(first.ok).toBe(true);

    // Otra cita que se solapa (10:30 dentro de 10:00–11:00).
    const overlap = await createAppointmentAction({
      ...basePayload(),
      time: "10:30",
    });
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) {
      expect(overlap.overlap?.clientName).toBe("Ana");
    }

    const forced = await createAppointmentAction({
      ...basePayload(),
      time: "10:30",
      force: true,
    });
    expect(forced.ok).toBe(true);
  });

  it("rechaza una clienta de otro tenant", async () => {
    const b = await seedUser();
    const tenantB = await seedTenantWithOwner(b.id, "Negocio B");
    const clientsRepo = await import("@/modules/clients/repository");
    const clientB = await clientsRepo.createClient(tenantB, {
      name: "De B",
      phone: "+573009998877",
      email: null,
      notes: null,
    });

    const result = await createAppointmentAction({
      ...basePayload(),
      clientId: clientB.id,
    });
    expect(result.ok).toBe(false);
  });

  it("crea una cita para una clienta recién creada", async () => {
    const clientsRepo = await import("@/modules/clients/repository");
    const nueva = await clientsRepo.createClient(tenantId, {
      name: "Recién creada",
      phone: "+573005556677",
      email: null,
      notes: null,
    });
    const result = await createAppointmentAction({
      ...basePayload(),
      clientId: nueva.id,
    });
    expect(result.ok).toBe(true);
  });

  // Comprobante discriminado por persona (D-38).
  describe("desglose por persona", () => {
    it("guarda el nombre y los servicios de cada persona cuando hay más de una", async () => {
      const result = await createAppointmentAction({
        ...basePayload(),
        peopleCount: 2,
        people: [
          { name: "Ana", serviceIds: [svc1] },
          { name: "María", serviceIds: [svc2] },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const repo = await import("./repository");
      const appt = await repo.getAppointment(tenantId, result.id);
      expect(appt?.people).toHaveLength(2);
      expect(appt?.people.map((p) => p.name)).toEqual(["Ana", "María"]);
      expect(appt?.people.find((p) => p.name === "Ana")?.serviceIds).toEqual([
        svc1,
      ]);
      expect(appt?.people.find((p) => p.name === "María")?.serviceIds).toEqual([
        svc2,
      ]);
    });

    it("no guarda nada cuando solo hay una persona (el nombre de la clienta ya es la fuente de verdad)", async () => {
      const result = await createAppointmentAction(basePayload());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const repo = await import("./repository");
      const appt = await repo.getAppointment(tenantId, result.id);
      expect(appt?.people).toEqual([]);
    });

    it("rechaza si falta el nombre de alguna persona cuando hay más de una", async () => {
      const result = await createAppointmentAction({
        ...basePayload(),
        peopleCount: 2,
        people: [
          { name: "Ana", serviceIds: [svc1] },
          { name: "", serviceIds: [svc2] },
        ],
      });
      expect(result.ok).toBe(false);
    });

    it("borra el desglose por persona al editar los servicios de la cita", async () => {
      const created = await createAppointmentAction({
        ...basePayload(),
        peopleCount: 2,
        people: [
          { name: "Ana", serviceIds: [svc1] },
          { name: "María", serviceIds: [svc2] },
        ],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const repo = await import("./repository");
      expect(
        (await repo.getAppointment(tenantId, created.id))?.people,
      ).toHaveLength(2);

      const edited = await editAppointmentAction(created.id, {
        services: [{ serviceId: svc1, quantity: 2 }],
      });
      expect(edited.ok).toBe(true);

      const appt = await repo.getAppointment(tenantId, created.id);
      expect(appt?.people).toEqual([]);
    });
  });
});
