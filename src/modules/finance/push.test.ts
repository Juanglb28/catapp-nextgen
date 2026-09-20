import { describe, expect, it } from "vitest";

import { overduePaymentsPushPayload } from "./push";

const base = {
  oldestClientName: "Ana María Pérez",
  oldestStartsAt: new Date("2026-09-19T15:00:00Z"),
  timezone: "America/Bogota",
};

describe("overduePaymentsPushPayload", () => {
  it("una cita: nombra a la clienta y enlaza a la tab Pendientes", () => {
    const p = overduePaymentsPushPayload({ ...base, count: 1 });
    expect(p.title).toBe("💰 Cobro pendiente");
    expect(p.body).toContain("Ana");
    expect(p.body).not.toContain("Pérez");
    expect(p.url).toBe("/citas?view=pendientes");
  });

  it("varias citas: resume el conteo y enlaza a la tab Pendientes", () => {
    const p = overduePaymentsPushPayload({ ...base, count: 3 });
    expect(p.title).toBe("💰 Tienes 3 citas sin cobrar");
    expect(p.url).toBe("/citas?view=pendientes");
  });
});
