import { describe, expect, it } from "vitest";

import { countByDayKey, daySummary, groupByDayKey } from "./agenda";

const TZ = "America/Bogota";

function item(iso: string, total = 0, paid = 0, status = "scheduled") {
  return {
    startsAt: new Date(iso),
    totalCop: BigInt(total),
    paidCop: BigInt(paid),
    status,
  };
}

describe("groupByDayKey (TZ del tenant)", () => {
  it("una cita de las 23:00 Bogotá cae en su día local, no en el UTC", () => {
    // 2026-06-12 23:00 Bogotá (UTC-5) = 2026-06-13 04:00 UTC
    const a = item("2026-06-13T04:00:00Z");
    const groups = groupByDayKey([a], TZ);
    expect(groups.has("2026-06-12")).toBe(true);
    expect(groups.has("2026-06-13")).toBe(false);
  });

  it("agrupa varias citas en sus días", () => {
    const groups = groupByDayKey(
      [
        item("2026-06-12T15:00:00Z"),
        item("2026-06-12T18:00:00Z"),
        item("2026-06-13T15:00:00Z"),
      ],
      TZ,
    );
    expect(groups.get("2026-06-12")).toHaveLength(2);
    expect(groups.get("2026-06-13")).toHaveLength(1);
  });
});

describe("countByDayKey", () => {
  it("cuenta citas por día", () => {
    const counts = countByDayKey(
      [item("2026-06-12T15:00:00Z"), item("2026-06-12T18:00:00Z")],
      TZ,
    );
    expect(counts.get("2026-06-12")).toBe(2);
  });
});

describe("daySummary", () => {
  it("suma total y pendiente, excluyendo canceladas", () => {
    const s = daySummary([
      item("2026-06-12T15:00:00Z", 60000, 20000), // pendiente 40000
      item("2026-06-12T16:00:00Z", 50000, 50000), // pendiente 0
      item("2026-06-12T17:00:00Z", 99999, 0, "cancelled"), // ignorada
    ]);
    expect(s.count).toBe(2);
    expect(s.totalCop).toBe(110000n);
    expect(s.pendingCop).toBe(40000n);
  });

  it("no resta de más si pagaron por encima del total", () => {
    const s = daySummary([item("2026-06-12T15:00:00Z", 10000, 15000)]);
    expect(s.pendingCop).toBe(0n);
  });
});
