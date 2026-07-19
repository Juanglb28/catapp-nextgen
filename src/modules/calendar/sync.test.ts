import { describe, expect, it } from "vitest";

import { buildCalendarEvent } from "./event";

/** Builder puro del evento de Google Calendar (F5.B2). */
describe("buildCalendarEvent", () => {
  const base = {
    clientName: "Ana",
    services: [
      { name: "Manicure", quantity: 1 },
      { name: "Pedicure", quantity: 2 },
    ],
    startsAt: new Date("2026-09-10T15:00:00.000Z"),
    endsAt: new Date("2026-09-10T16:00:00.000Z"),
    timeZone: "America/Bogota",
    detailUrl: "https://app.test/citas/abc",
  };

  it("arma el summary con 💅, clienta y servicios (cantidad >1 con ×N)", () => {
    const e = buildCalendarEvent(base);
    expect(e.summary).toBe("💅 Ana — Manicure, Pedicure ×2");
  });

  it("usa la TZ del tenant y las horas en UTC (ISO)", () => {
    const e = buildCalendarEvent(base);
    expect(e.start).toEqual({
      dateTime: "2026-09-10T15:00:00.000Z",
      timeZone: "America/Bogota",
    });
    expect(e.end.dateTime).toBe("2026-09-10T16:00:00.000Z");
    expect(e.end.timeZone).toBe("America/Bogota");
  });

  it("incluye el link al detalle en la descripción", () => {
    const e = buildCalendarEvent(base);
    expect(e.description).toContain("https://app.test/citas/abc");
  });

  it("sin correo de clienta no añade asistentes", () => {
    const e = buildCalendarEvent(base);
    expect(e.attendees).toBeUndefined();
  });

  it("con correo añade a la clienta como asistente", () => {
    const e = buildCalendarEvent({ ...base, attendeeEmail: "ana@mail.com" });
    expect(e.attendees).toEqual([{ email: "ana@mail.com" }]);
  });

  it("un solo servicio sin cantidad no muestra ×1", () => {
    const e = buildCalendarEvent({
      ...base,
      services: [{ name: "Manicure", quantity: 1 }],
    });
    expect(e.summary).toBe("💅 Ana — Manicure");
  });
});
