import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

import { reminderWindow } from "./reminders";

/**
 * Selección de citas para recordatorio (F8.B2): ventana 20–28h, respeta el
 * toggle del tenant y el opt-out de la clienta, y la idempotencia (no repite si
 * ya hay un wa_message). Cross-tenant. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)(
  "recordatorios — listDueReminders (integración)",
  () => {
    let tenantA: string;
    let tenantB: string;
    const now = new Date();
    const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
    // Teléfono único por clienta: hay un unique (tenant_id, phone) desde 0020,
    // así que cada seedAppt debe usar un número distinto.
    let phoneSeq = 0;
    const nextPhone = () =>
      `+5730011${String(10000 + phoneSeq++).slice(-5)}`;

    async function seedAppt(
      tenantId: string,
      opts: { startsAt: Date; optOut?: boolean },
    ) {
      const clientsRepo = await import("@/modules/clients/repository");
      const servicesRepo = await import("@/modules/services/repository");
      const apptRepo = await import("@/modules/appointments/repository");
      const client = await clientsRepo.createClient(tenantId, {
        name: "Clienta",
        phone: nextPhone(),
        email: null,
        notes: null,
      });
      if (opts.optOut) {
        await clientsRepo.setClientOptOut(tenantId, client.id, true);
      }
      const svc = await servicesRepo.createService(tenantId, {
        name: "Manicure",
        basePriceCop: 10000n,
        durationMin: 45,
      });
      return apptRepo.createAppointment(tenantId, {
        clientId: client.id,
        startsAt: opts.startsAt,
        endsAt: new Date(opts.startsAt.getTime() + 45 * 60_000),
        services: [{ serviceId: svc.id, priceCop: 10000n, quantity: 1 }],
      });
    }

    async function due() {
      const repo = await import("./repository");
      const { from, to } = reminderWindow(now);
      return repo.listDueReminders(from, to, "recordatorio");
    }

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

    it("incluye solo las citas dentro de la ventana (24h sí, 3h y 30h no)", async () => {
      const inWindow = await seedAppt(tenantA, { startsAt: at(24) });
      await seedAppt(tenantA, { startsAt: at(3) });
      await seedAppt(tenantA, { startsAt: at(30) });

      const ids = (await due()).map((d) => d.appointmentId);
      expect(ids).toEqual([inWindow.id]);
    });

    it("no repite si ya existe un wa_message de la plantilla (idempotencia)", async () => {
      const appt = await seedAppt(tenantA, { startsAt: at(24) });
      expect((await due()).map((d) => d.appointmentId)).toContain(appt.id);

      const repo = await import("./repository");
      await repo.queueMessage(tenantA, {
        appointmentId: appt.id,
        toPhone: "573001112233",
        templateName: "recordatorio",
      });
      expect((await due()).map((d) => d.appointmentId)).not.toContain(appt.id);
    });

    it("respeta el opt-out de la clienta", async () => {
      await seedAppt(tenantA, { startsAt: at(24), optOut: true });
      expect(await due()).toHaveLength(0);
    });

    it("respeta el toggle del tenant (auto_messages off)", async () => {
      await seedAppt(tenantA, { startsAt: at(24) });
      const tenancy = await import("@/modules/tenancy/repository");
      await tenancy.setAutoMessages(tenantA, false);
      expect(await due()).toHaveLength(0);
    });

    it("es cross-tenant pero no mezcla datos entre negocios", async () => {
      const a = await seedAppt(tenantA, { startsAt: at(24) });
      const b = await seedAppt(tenantB, { startsAt: at(24) });
      const rows = await due();
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.appointmentId === a.id)?.tenantId).toBe(
        tenantA,
      );
      expect(rows.find((r) => r.appointmentId === b.id)?.tenantId).toBe(
        tenantB,
      );
    });
  },
);
