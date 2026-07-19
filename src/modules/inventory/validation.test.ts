import { describe, expect, it } from "vitest";

import {
  adjustFormSchema,
  movementFormSchema,
  productFormSchema,
} from "./validation";

describe("productFormSchema", () => {
  const base = { name: "Esmalte", unit: "ml", minStock: 2, costCop: null };

  it("acepta un producto válido", () => {
    expect(productFormSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza nombre vacío", () => {
    expect(productFormSchema.safeParse({ ...base, name: "  " }).success).toBe(
      false,
    );
  });
  it("rechaza una unidad no soportada", () => {
    expect(
      productFormSchema.safeParse({ ...base, unit: "litro" }).success,
    ).toBe(false);
  });
  it("rechaza mínimo negativo", () => {
    expect(productFormSchema.safeParse({ ...base, minStock: -1 }).success).toBe(
      false,
    );
  });
});

describe("movementFormSchema", () => {
  it("acepta una salida con cantidad positiva", () => {
    expect(
      movementFormSchema.safeParse({ type: "out", quantity: 2 }).success,
    ).toBe(true);
  });
  it("rechaza cantidad 0 o negativa", () => {
    expect(
      movementFormSchema.safeParse({ type: "in", quantity: 0 }).success,
    ).toBe(false);
    expect(
      movementFormSchema.safeParse({ type: "in", quantity: -3 }).success,
    ).toBe(false);
  });
});

describe("adjustFormSchema", () => {
  it("exige motivo", () => {
    expect(
      adjustFormSchema.safeParse({ realStock: 5, reason: "" }).success,
    ).toBe(false);
    expect(
      adjustFormSchema.safeParse({ realStock: 5, reason: "Conteo" }).success,
    ).toBe(true);
  });
});
