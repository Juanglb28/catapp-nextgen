import { describe, expect, it } from "vitest";

import {
  computeTotal,
  derivePaymentStatus,
  isLocked,
  validateTimeRange,
} from "./domain";

describe("isLocked", () => {
  it("solo cancelada está bloqueada", () => {
    expect(isLocked("cancelled")).toBe(true);
  });
  it("completada, agendada y no asistió NO están bloqueadas", () => {
    expect(isLocked("completed")).toBe(false);
    expect(isLocked("scheduled")).toBe(false);
    expect(isLocked("no_show")).toBe(false);
  });
});

describe("derivePaymentStatus", () => {
  it("pagado 0 -> pending", () => {
    expect(derivePaymentStatus(1000n, 0n)).toBe("pending");
  });
  it("0 < pagado < total -> partial", () => {
    expect(derivePaymentStatus(1000n, 500n)).toBe("partial");
  });
  it("pagado == total -> paid", () => {
    expect(derivePaymentStatus(1000n, 1000n)).toBe("paid");
  });
  it("pagado > total -> paid", () => {
    expect(derivePaymentStatus(1000n, 1500n)).toBe("paid");
  });
  it("total 0 (nada por cobrar, bono cubre todo) -> paid", () => {
    expect(derivePaymentStatus(0n, 0n)).toBe("paid");
  });
  it("pagado negativo -> pending (guarda)", () => {
    expect(derivePaymentStatus(1000n, -100n)).toBe("pending");
  });
});

describe("computeTotal", () => {
  it("suma precio * cantidad de cada servicio", () => {
    expect(
      computeTotal([
        { priceCop: 1000n, quantity: 2 },
        { priceCop: 500n, quantity: 1 },
      ]),
    ).toBe(2500n);
  });
  it("sin servicios es 0", () => {
    expect(computeTotal([])).toBe(0n);
  });
  it("el override manda sobre la suma", () => {
    expect(computeTotal([{ priceCop: 1000n, quantity: 2 }], 9999n)).toBe(9999n);
  });
  it("override null se ignora (se calcula la suma)", () => {
    expect(computeTotal([{ priceCop: 1000n, quantity: 2 }], null)).toBe(2000n);
  });
  it("override 0 es un override válido", () => {
    expect(computeTotal([{ priceCop: 1000n, quantity: 2 }], 0n)).toBe(0n);
  });
});

describe("validateTimeRange", () => {
  it("válido si termina después de empezar", () => {
    expect(
      validateTimeRange(
        new Date("2026-06-11T10:00:00Z"),
        new Date("2026-06-11T11:00:00Z"),
      ),
    ).toBe(true);
  });
  it("inválido si termina igual que empieza", () => {
    const t = new Date("2026-06-11T10:00:00Z");
    expect(validateTimeRange(t, t)).toBe(false);
  });
  it("inválido si termina antes de empezar", () => {
    expect(
      validateTimeRange(
        new Date("2026-06-11T11:00:00Z"),
        new Date("2026-06-11T10:00:00Z"),
      ),
    ).toBe(false);
  });
});
