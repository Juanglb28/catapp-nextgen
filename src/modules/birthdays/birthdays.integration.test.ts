import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Ciclo del bono de cumpleaños contra DB real (B2.2): aplicación transaccional
 * (descuento + redención todo-o-nada) y resolución del año en la TZ del tenant.
 * Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("bono de cumpleaños (integración)", () => {
  let tenantA: string;
  let clientId: string;
  let serviceId: string;
  let optionId: string;

  async function seedChosenBonus(): Promise<string> {
    const bd = await import("./repository");
    const year = new Date().getFullYear();
    const bonus = await bd.upsertBirthdayBonus(tenantA, clientId, year);
    await bd.approveBirthdayBonus(tenantA, bonus.id);
    await bd.chooseBirthdayOption(bonus.id, {
      id: optionId,
      label: "Manicure",
    });
    return bonus.id;
  }

  async function newAppointment(): Promise<string> {
    const appt = await import("@/modules/appointments/repository");
    const a = await appt.createAppointment(tenantA, {
      clientId,
      startsAt: new Date("2026-09-10T15:00:00Z"),
      endsAt: new Date("2026-09-10T16:00:00Z"),
      services: [{ serviceId, priceCop: 40000n, quantity: 1 }],
    });
    return a.id;
  }

  beforeEach(async () => {
    await resetDb();
    const u = await seedUser();
    tenantA = await seedTenantWithOwner(u.id, "Negocio A");

    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    const bd = await import("./repository");

    clientId = (
      await clientsRepo.createClient(tenantA, {
        name: "Ana",
        phone: "+573001112233",
        email: null,
        notes: null,
      })
    ).id;
    serviceId = (
      await servicesRepo.createService(tenantA, {
        name: "Manicure",
        basePriceCop: 40000n,
        durationMin: 45,
      })
    ).id;
    optionId = (
      await bd.createBonusOption(tenantA, {
        label: "Manicure",
        discountCop: 15000n,
      })
    ).id;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("aplica el descuento y redime el bono en una transacción", async () => {
    const bd = await import("./repository");
    const appt = await import("@/modules/appointments/repository");
    const bonusId = await seedChosenBonus();
    const apptId = await newAppointment();

    const updated = await appt.applyBonusDiscountAndRedeem(tenantA, {
      appointmentId: apptId,
      bonusId,
      discountCop: 15000n,
    });
    expect(updated?.bonusDiscountCop).toBe(15000n);

    // El bono quedó redimido y enlazado a la cita.
    const redeemed = await bd.getBonusForAppointment(tenantA, apptId);
    expect(redeemed?.status).toBe("redeemed");
    expect(redeemed?.id).toBe(bonusId);
  });

  it("no reutiliza: aplicar dos veces falla y no vuelve a descontar", async () => {
    const appt = await import("@/modules/appointments/repository");
    const bonusId = await seedChosenBonus();
    const apptId1 = await newAppointment();

    await appt.applyBonusDiscountAndRedeem(tenantA, {
      appointmentId: apptId1,
      bonusId,
      discountCop: 15000n,
    });

    // Segunda cita, mismo bono (ya redimido) → debe lanzar y NO descontar.
    const apptId2 = await newAppointment();
    await expect(
      appt.applyBonusDiscountAndRedeem(tenantA, {
        appointmentId: apptId2,
        bonusId,
        discountCop: 15000n,
      }),
    ).rejects.toThrow();

    const untouched = await appt.getAppointment(tenantA, apptId2);
    expect(untouched?.bonusDiscountCop).toBe(0n); // rollback: sin descuento
  });

  it("atomicidad: si el bono no está 'chosen', revierte el descuento", async () => {
    const bd = await import("./repository");
    const appt = await import("@/modules/appointments/repository");
    const year = new Date().getFullYear();
    // Bono en 'approved' (no 'chosen') → la redención no afecta filas → throw.
    const bonus = await bd.upsertBirthdayBonus(tenantA, clientId, year);
    await bd.approveBirthdayBonus(tenantA, bonus.id);
    const apptId = await newAppointment();

    await expect(
      appt.applyBonusDiscountAndRedeem(tenantA, {
        appointmentId: apptId,
        bonusId: bonus.id,
        discountCop: 15000n,
      }),
    ).rejects.toThrow();

    const untouched = await appt.getAppointment(tenantA, apptId);
    expect(untouched?.bonusDiscountCop).toBe(0n);
  });

  it("getActiveBonusForClient resuelve el año en la TZ del tenant", async () => {
    const bd = await import("./repository");
    await seedChosenBonus();
    // El bono es del año en curso (Bogotá); debe encontrarse.
    const active = await bd.getActiveBonusForClient(
      tenantA,
      clientId,
      "America/Bogota",
    );
    expect(active?.status).toBe("chosen");
  });

  // D-28: revertir un borrado hecho por error.
  it("declinar guarda el estado anterior y revertir lo restaura", async () => {
    const bd = await import("./repository");
    const bonusId = await seedChosenBonus();

    const declined = await bd.declineBirthdayBonus(tenantA, bonusId);
    expect(declined?.status).toBe("declined");
    expect(declined?.declinedFromStatus).toBe("chosen");

    // Aparece en la lista de recuperables.
    const listed = await bd.listDeclinedBonuses(tenantA);
    expect(listed.map((b) => b.id)).toContain(bonusId);

    const reverted = await bd.revertDeclinedBonus(tenantA, bonusId);
    expect(reverted?.status).toBe("chosen");
    expect(reverted?.declinedFromStatus).toBeNull();

    // Ya no aparece entre los recuperables una vez revertido.
    const listedAfter = await bd.listDeclinedBonuses(tenantA);
    expect(listedAfter.map((b) => b.id)).not.toContain(bonusId);
  });

  it("revertir un bono que no está 'declined' no hace nada", async () => {
    const bd = await import("./repository");
    const bonusId = await seedChosenBonus(); // queda en 'chosen', nunca declinado

    const result = await bd.revertDeclinedBonus(tenantA, bonusId);
    expect(result).toBeNull();

    const untouched = await bd.getActiveBonusForClient(
      tenantA,
      clientId,
      "America/Bogota",
    );
    expect(untouched?.status).toBe("chosen");
  });

  it("declinar dos veces seguidas conserva el estado anterior original", async () => {
    const bd = await import("./repository");
    const bonusId = await seedChosenBonus();

    await bd.declineBirthdayBonus(tenantA, bonusId);
    // Segundo clic sobre un bono ya 'declined': no debe pisar
    // `declinedFromStatus` con 'declined'.
    const declinedAgain = await bd.declineBirthdayBonus(tenantA, bonusId);
    expect(declinedAgain?.status).toBe("declined");
    expect(declinedAgain?.declinedFromStatus).toBe("chosen");

    const reverted = await bd.revertDeclinedBonus(tenantA, bonusId);
    expect(reverted?.status).toBe("chosen");
  });
});
