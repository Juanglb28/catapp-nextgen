import { describe, expect, it } from "vitest";

import { formatCOP, parseCOP } from "./money";

describe("formatCOP", () => {
  it("formatea cero", () => expect(formatCOP(0n)).toBe("$0"));
  it("formatea miles", () => expect(formatCOP(50000n)).toBe("$50.000"));
  it("formatea millones", () => expect(formatCOP(1234567n)).toBe("$1.234.567"));
  it("formatea montos grandes", () =>
    expect(formatCOP(1000000000n)).toBe("$1.000.000.000"));
  it("formatea negativos", () => expect(formatCOP(-5000n)).toBe("-$5.000"));
});

describe("parseCOP", () => {
  it("parsea número plano", () => expect(parseCOP("50000")).toBe(50000n));
  it("parsea con símbolo y puntos", () =>
    expect(parseCOP("$50.000")).toBe(50000n));
  it("parsea con espacios", () =>
    expect(parseCOP("$ 1.234.567")).toBe(1234567n));
  it("parsea cero", () => expect(parseCOP("0")).toBe(0n));
  it("ida y vuelta con formatCOP", () =>
    expect(parseCOP(formatCOP(987654n))).toBe(987654n));
  it("lanza con cadena vacía", () => expect(() => parseCOP("")).toThrow());
  it("lanza con texto no numérico", () =>
    expect(() => parseCOP("abc")).toThrow());
});
