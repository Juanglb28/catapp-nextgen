import { describe, expect, it } from "vitest";

import { adjustDelta, isLowStock, movementDelta } from "./domain";

describe("isLowStock", () => {
  it("sin mínimo configurado (0) nunca alerta", () => {
    expect(isLowStock(0, 0)).toBe(false);
    expect(isLowStock(5, 0)).toBe(false);
  });
  it("alerta cuando el stock llega o baja del mínimo", () => {
    expect(isLowStock(2, 3)).toBe(true);
    expect(isLowStock(3, 3)).toBe(true);
  });
  it("no alerta por encima del mínimo", () => {
    expect(isLowStock(4, 3)).toBe(false);
  });
});

describe("movementDelta", () => {
  it("'in' suma, 'out' resta", () => {
    expect(movementDelta("in", 5)).toBe(5);
    expect(movementDelta("out", 5)).toBe(-5);
  });
  it("'adjust' usa el delta con signo tal cual", () => {
    expect(movementDelta("adjust", 4)).toBe(4);
    expect(movementDelta("adjust", -4)).toBe(-4);
  });
});

describe("adjustDelta", () => {
  it("calcula cuánto sumar/restar para llegar al valor real contado", () => {
    expect(adjustDelta(7, 4)).toBe(3); // faltaba sumar 3
    expect(adjustDelta(2, 5)).toBe(-3); // sobraban 3
    expect(adjustDelta(5, 5)).toBe(0); // ya coincide
  });
});
