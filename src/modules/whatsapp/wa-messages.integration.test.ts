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
    if (!id) throw new Error("expected queued id");
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
    if (!id) throw new Error("expected queued id");
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

  it("idempotencia por constraint: encolar 2× la misma cita+plantilla en paralelo crea 1 sola fila (QA B5)", async () => {
    const repo = await import("./messages");
    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    const apptRepo = await import("@/modules/appointments/repository");

    const clientId = (
      await clientsRepo.createClient(tenantId, {
        name: "Beatriz",
        phone: "+573007778899",
        email: null,
        notes: null,
      })
    ).id;
    const serviceId = (
      await servicesRepo.createService(tenantId, {
        name: "Pedicure",
        basePriceCop: 20000n,
        durationMin: 60,
      })
    ).id;
    const appt = await apptRepo.createAppointment(tenantId, {
      clientId,
      startsAt: new Date("2026-10-01T15:00:00Z"),
      endsAt: new Date("2026-10-01T16:00:00Z"),
      services: [{ serviceId, priceCop: 20000n, quantity: 1 }],
    });

    // Dos ejecuciones solapadas del cron intentan encolar a la vez.
    const [a, b] = await Promise.all([
      repo.queueMessage(tenantId, {
        appointmentId: appt.id,
        toPhone: "573007778899",
        templateName: "recordatorio",
      }),
      repo.queueMessage(tenantId, {
        appointmentId: appt.id,
        toPhone: "573007778899",
        templateName: "recordatorio",
      }),
    ]);

    // Exactamente una obtiene id; la otra ve el conflicto y devuelve null.
    const ids = [a, b].filter((x): x is string => x !== null);
    expect(ids).toHaveLength(1);
  });
});
