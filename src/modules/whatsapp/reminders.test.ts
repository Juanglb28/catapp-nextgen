import { describe, expect, it } from "vitest";

import {
  appointmentTemplateVariables,
  isWithinReminderWindow,
  reminderWindow,
} from "./reminders";

const now = new Date("2026-06-12T12:00:00.000Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe("reminderWindow", () => {
  it("va de +20h a +28h", () => {
    const { from, to } = reminderWindow(now);
    expect(from.toISOString()).toBe("2026-06-13T08:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-13T16:00:00.000Z");
  });
});

describe("isWithinReminderWindow", () => {
  it("una cita a ~24h entra", () => {
    expect(isWithinReminderWindow(hours(24), now)).toBe(true);
  });
  it("una cita a 3h NO entra (muy pronto)", () => {
    expect(isWithinReminderWindow(hours(3), now)).toBe(false);
  });
  it("una cita a 30h NO entra (aún lejos)", () => {
    expect(isWithinReminderWindow(hours(30), now)).toBe(false);
  });
  it("fronteras: +20h entra, +28h no (rango semiabierto)", () => {
    expect(isWithinReminderWindow(hours(20), now)).toBe(true);
    expect(isWithinReminderWindow(hours(28), now)).toBe(false);
  });
});

describe("appointmentTemplateVariables", () => {
  it("arma nombre de pila, fecha/hora en TZ y link público", () => {
    process.env.BETTER_AUTH_URL = "https://app.test";
    const vars = appointmentTemplateVariables({
      clientName: "Ana María Pérez",
      startsAt: new Date("2026-06-13T14:00:00.000Z"),
      timezone: "America/Bogota",
      publicToken: "tok-123",
    });
    expect(vars[0]).toBe("Ana"); // nombre de pila
    expect(vars[1]).toContain("2026"); // fecha legible
    expect(vars[2]).toBe("https://app.test/cita/tok-123");
  });
});
