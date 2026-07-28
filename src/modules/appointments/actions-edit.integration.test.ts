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

import {
  editAppointmentAction,
  registerPaymentAction,
  setAppointmentStatusAction,
} from "./actions";

const requireTenantMock = vi.mocked(requireTenant);

/**
 * Edición en vivo (F3.B4) contra DB real: precios congelados al editar, y citas
 * cerradas que rechazan edición pero aceptan pagos. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("acciones de edición de cita (integración)", () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let svc1: string;
  let svc2: string;

  async function createAppt() {
    const repo = await import("./repository");
    return repo.createAppointment(tenantId, {
      clientId,
      startsAt: new Date("2026-09-10T15:00:00Z"),
      endsAt: new Date("2026-09-10T16:00:00Z"),
      services: [{ serviceId: svc1, priceCop: 25000n, quantity: 1 }],
    });
  }

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

  it("preserva el precio congelado de un servicio existente y congela el nuevo", async () => {
    const repo = await import("./repository");
    const servicesRepo = await import("@/modules/services/repository");
    const appt = await createAppt(); // svc1 congelado a 25000

    // El catálogo sube de precio DESPUÉS de crear la cita.
    await servicesRepo.updateService(tenantId, svc1, {
      name: "Manicure",
      basePriceCop: 30000n,
      durationMin: 45,
    });

    // Editar: svc1 x2 (debe seguir a 25000) + svc2 nuevo (a 35000 actual).
    const result = await editAppointmentAction(appt.id, {
      services: [
        { serviceId: svc1, quantity: 2 },
        { serviceId: svc2, quantity: 1 },
      ],
    });
    expect(result.ok).toBe(true);

    const updated = await repo.getAppointment(tenantId, appt.id);
    // 25000*2 (congelado) + 35000 = 85000
    expect(updated?.totalCop).toBe(85000n);
    const svc1Line = updated?.services.find((s) => s.serviceId === svc1);
    expect(svc1Line?.priceCop).toBe(25000n);
  });

  it("una cita completada rechaza editar servicios pero acepta pagos", async () => {
    const repo = await import("./repository");
    const appt = await createAppt();

    // Item 5: para completar debe registrarse el pago (aquí un abono en efectivo).
    const abono = await registerPaymentAction(appt.id, { cash: 10000 });
    expect(abono.ok).toBe(true);

    const done = await setAppointmentStatusAction(appt.id, {
      status: "completed",
    });
    expect(done.ok).toBe(true);

    const edit = await editAppointmentAction(appt.id, {
      services: [{ serviceId: svc1, quantity: 3 }],
    });
    expect(edit.ok).toBe(false);

    // Aún completada, acepta más pagos (aquí el resto por transferencia).
    const pay = await registerPaymentAction(appt.id, { transfer: 15000 });
    expect(pay.ok).toBe(true);

    const after = await repo.getAppointment(tenantId, appt.id);
    expect(after?.paidCop).toBe(25000n);
    expect(after?.paymentStatus).toBe("paid");
  });

  it("override manual del total y volver al calculado", async () => {
    const repo = await import("./repository");
    const appt = await createAppt(); // total 25000

    await editAppointmentAction(appt.id, { totalOverride: 99000 });
    expect((await repo.getAppointment(tenantId, appt.id))?.totalCop).toBe(
      99000n,
    );

    await editAppointmentAction(appt.id, { totalOverride: null });
    expect((await repo.getAppointment(tenantId, appt.id))?.totalCop).toBe(
      25000n,
    );
  });

  it("no permite completar una cita ya cancelada", async () => {
    const appt = await createAppt();
    await setAppointmentStatusAction(appt.id, { status: "cancelled" });
    const result = await setAppointmentStatusAction(appt.id, {
      status: "completed",
    });
    expect(result.ok).toBe(false);
  });
});
