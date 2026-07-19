import { describe, expect, it } from "vitest";

import {
  DEFAULT_TZ,
  formatDateLong,
  formatTime,
  tenantDayKey,
  tenantMonthRangeUtc,
} from "./dates";

// 2026-06-11T02:00:00Z == 2026-06-10 21:00 en Bogotá (UTC-5).
const instant = new Date("2026-06-11T02:00:00Z");

describe("tenantDayKey", () => {
  it("usa la frontera de día de Bogotá", () => {
    expect(tenantDayKey(instant, "America/Bogota")).toBe("2026-06-10");
  });
  it("difiere en UTC (mismo instante, otro día)", () => {
    expect(tenantDayKey(instant, "UTC")).toBe("2026-06-11");
  });
  it("usa America/Bogota por defecto", () => {
    expect(tenantDayKey(instant)).toBe(tenantDayKey(instant, DEFAULT_TZ));
  });
});

describe("formatDateLong", () => {
  it("formatea en español", () => {
    const s = formatDateLong(instant, "America/Bogota");
    expect(s).toContain("junio");
    expect(s).toContain("2026");
    expect(s).toContain("10");
  });
});

describe("formatTime", () => {
  it("formatea hora 12h en la TZ del tenant", () => {
    expect(formatTime(instant, "America/Bogota")).toMatch(/^9:00/);
    expect(formatTime(instant, "UTC")).toMatch(/^2:00/);
  });
});

describe("tenantMonthRangeUtc", () => {
  it("junio 2026 en Bogotá empieza el 1 jun 00:00 (= 05:00 UTC)", () => {
    const { start, end } = tenantMonthRangeUtc(2026, 6, "America/Bogota");
    expect(start.toISOString()).toBe("2026-06-01T05:00:00.000Z");
    // [start, end): el fin es el 1 de julio 00:00 Bogotá.
    expect(end.toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });

  it("diciembre cruza de año correctamente", () => {
    const { start, end } = tenantMonthRangeUtc(2026, 12, "America/Bogota");
    expect(start.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  it("difiere de las fronteras en UTC", () => {
    const { start } = tenantMonthRangeUtc(2026, 6, "UTC");
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
