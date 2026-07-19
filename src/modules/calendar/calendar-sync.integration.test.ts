import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

import type { CalendarEventBody } from "./event";
import { type GoogleCalendarPort, syncAppointment } from "./sync";

/**
 * Máquina de estados de sync con Google Calendar (F5.B2) contra DB real y un
 * puerto de Google FALSO (en memoria): crear → editar → cancelar, 404 → recrear,
 * error → status error, y respeto del aislamiento/sin-conexión.
 * Requiere `TEST_DATABASE_URL`.
 */

function makePort(
  opts: {
    notFoundOnUpdate?: boolean;
    failCreate?: boolean;
    noAccess?: boolean;
  } = {},
) {
  const store = new Map<string, CalendarEventBody>();
  let n = 0;
  const deleted: string[] = [];
  const port: GoogleCalendarPort = {
    getAccess: async () =>
      opts.noAccess ? null : { accessToken: "tok", calendarId: "primary" },
    createEvent: async (_a, _c, event) => {
      if (opts.failCreate) throw new Error("boom");
      const id = `evt-${++n}`;
      store.set(id, event);
      return id;
    },
    updateEvent: async (_a, _c, eventId, event) => {
      if (opts.notFoundOnUpdate || !store.has(eventId)) return "notfound";
      store.set(eventId, event);
      return "updated";
    },
    deleteEvent: async (_a, _c, eventId) => {
      store.delete(eventId);
      deleted.push(eventId);
    },
  };
  return { port, store, deleted };
}

describe.runIf(TEST_DB)("syncAppointment (integración)", () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let serviceId: string;

  async function seedAppointment(email: string | null = null) {
    const clientsRepo = await import("@/modules/clients/repository");
    const servicesRepo = await import("@/modules/services/repository");
    const apptRepo = await import("@/modules/appointments/repository");
    clientId = (
      await clientsRepo.createClient(tenantId, {
        name: "Ana",
        phone: "+573001112233",
        email,
        notes: null,
      })
    ).id;
    serviceId = (
      await servicesRepo.createService(tenantId, {
        name: "Manicure",
        basePriceCop: 25000n,
        durationMin: 45,
      })
    ).id;
    const appt = await apptRepo.createAppointment(tenantId, {
      clientId,
      startsAt: new Date("2026-09-10T15:00:00.000Z"),
      endsAt: new Date("2026-09-10T15:45:00.000Z"),
      services: [{ serviceId, priceCop: 25000n, quantity: 1 }],
    });
    return appt.id;
  }

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    userId = a.id;
    tenantId = await seedTenantWithOwner(a.id, "Negocio A");
  });

  afterAll(async () => {
    await closeDb();
  });

  it("crea el evento y guarda gcal_event_id + status ok", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();
    const { port, store } = makePort();

    await syncAppointment(tenantId, id, {}, port);

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBe("evt-1");
    expect(appt?.gcalSyncStatus).toBe("ok");
    expect(store.size).toBe(1);
  });

  it("re-sincronizar usa update (mismo event id)", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();
    const { port } = makePort();

    await syncAppointment(tenantId, id, {}, port);
    await syncAppointment(tenantId, id, {}, port);

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBe("evt-1"); // no se recreó
    expect(appt?.gcalSyncStatus).toBe("ok");
  });

  it("404 al actualizar (borrado a mano) recrea el evento", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();

    await syncAppointment(tenantId, id, {}, makePort().port);
    // Segundo sync con un puerto que siempre responde 404 al actualizar.
    const recreate = makePort({ notFoundOnUpdate: true });
    await syncAppointment(tenantId, id, {}, recreate.port);

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBe("evt-1"); // nuevo id en el puerto recreador
    expect(appt?.gcalSyncStatus).toBe("ok");
  });

  it("cancelar borra el evento y limpia gcal_event_id", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();
    const { port, store, deleted } = makePort();

    await syncAppointment(tenantId, id, {}, port);
    expect(store.size).toBe(1);

    await apptRepo.cancelAppointment(tenantId, id, userId);
    await syncAppointment(tenantId, id, {}, port);

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBeNull();
    expect(appt?.gcalSyncStatus).toBe("ok");
    expect(deleted).toEqual(["evt-1"]);
    expect(store.size).toBe(0);
  });

  it("un fallo de Google deja status = error", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();

    await syncAppointment(
      tenantId,
      id,
      {},
      makePort({ failCreate: true }).port,
    );

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBeNull();
    expect(appt?.gcalSyncStatus).toBe("error");
  });

  it("sin conexión activa no hace nada (status sigue null)", async () => {
    const apptRepo = await import("@/modules/appointments/repository");
    const id = await seedAppointment();

    await syncAppointment(tenantId, id, {}, makePort({ noAccess: true }).port);

    const appt = await apptRepo.getAppointment(tenantId, id);
    expect(appt?.gcalEventId).toBeNull();
    expect(appt?.gcalSyncStatus).toBeNull();
  });

  it("con invitación añade a la clienta como asistente", async () => {
    const id = await seedAppointment("ana@mail.com");
    const { port, store } = makePort();

    await syncAppointment(tenantId, id, { invite: true }, port);

    const event = [...store.values()][0];
    expect(event.attendees).toEqual([{ email: "ana@mail.com" }]);
  });
});
