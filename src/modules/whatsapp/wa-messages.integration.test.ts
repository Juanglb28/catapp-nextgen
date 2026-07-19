import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Ciclo de vida de un mensaje de WhatsApp (F8.B1): queued → sent → delivered →
 * read vía webhook simulado, sin retroceder de estado; markFailed; y la marca de
 * idempotencia `hasMessage`. Requiere `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("wa_messages (integración)", () => {
  let tenantId: string;

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    tenantId = await seedTenantWithOwner(a.id, "Negocio A");
  });

  afterAll(async () => {
    await closeDb();
  });

  async function statusOf(id: string) {
    const { db } = await import("@/lib/db");
    const { waMessages } = await import("./schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(waMessages)
      .where(eq(waMessages.id, id))
      .limit(1);
    return row;
  }

  it("queued → sent → delivered → read; no retrocede", async () => {
    const repo = await import("./messages");
    const id = await repo.queueMessage(tenantId, {
      toPhone: "573001112233",
      templateName: "recordatorio",
    });
    expect((await statusOf(id)).status).toBe("queued");

    await repo.markSent(id, "wamid.1");
    expect((await statusOf(id)).waMessageId).toBe("wamid.1");

    await repo.updateStatusByWaId("wamid.1", "delivered");
    expect((await statusOf(id)).status).toBe("delivered");

    // Webhook desordenado: un 'sent' tardío no debe retroceder.
    await repo.updateStatusByWaId("wamid.1", "sent");
    expect((await statusOf(id)).status).toBe("delivered");

    await repo.updateStatusByWaId("wamid.1", "read");
    expect((await statusOf(id)).status).toBe("read");
  });

  it("markFailed guarda el error", async () => {
    const repo = await import("./messages");
    const id = await repo.queueMessage(tenantId, {
      toPhone: "573000000000",
      templateName: "recordatorio",
    });
    await repo.markFailed(id, "invalid_number");
    const row = await statusOf(id);
    expect(row.status).toBe("failed");
    expect(row.error).toBe("invalid_number");
  });

  it("hasMessage detecta envíos previos a la misma cita+plantilla", async () => {
    const repo = await import("./messages");
    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    const apptRepo = await import("@/modules/appointments/repository");

    const clientId = (
      await clientsRepo.createClient(tenantId, {
        name: "Ana",
        phone: "+573001112233",
        email: null,
        notes: null,
      })
    ).id;
    const serviceId = (
      await servicesRepo.createService(tenantId, {
        name: "Manicure",
        basePriceCop: 10000n,
        durationMin: 45,
      })
    ).id;
    const appt = await apptRepo.createAppointment(tenantId, {
      clientId,
      startsAt: new Date("2026-09-10T15:00:00Z"),
      endsAt: new Date("2026-09-10T15:45:00Z"),
      services: [{ serviceId, priceCop: 10000n, quantity: 1 }],
    });

    expect(await repo.hasMessage(tenantId, appt.id, "recordatorio")).toBe(
      false,
    );
    await repo.queueMessage(tenantId, {
      appointmentId: appt.id,
      toPhone: "573001112233",
      templateName: "recordatorio",
    });
    expect(await repo.hasMessage(tenantId, appt.id, "recordatorio")).toBe(true);
    // Otra plantilla a la misma cita aún no se envió.
    expect(await repo.hasMessage(tenantId, appt.id, "agradecimiento")).toBe(
      false,
    );
  });
});
