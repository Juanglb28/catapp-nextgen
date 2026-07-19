import { describe, expect, it } from "vitest";

import { serviceFormSchema } from "./validation";

const base = { name: "Manicure", basePriceCop: 25000, durationMin: 45 };

describe("serviceFormSchema", () => {
  it("acepta un servicio válido", () => {
    expect(serviceFormSchema.safeParse(base).success).toBe(true);
  });

  it("acepta precio 0 (servicio gratuito / promo)", () => {
    expect(
      serviceFormSchema.safeParse({ ...base, basePriceCop: 0 }).success,
    ).toBe(true);
  });

  it("rechaza precio negativo", () => {
    const r = serviceFormSchema.safeParse({ ...base, basePriceCop: -1000 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/negativo/i);
  });

  it("rechaza precio no entero", () => {
    expect(
      serviceFormSchema.safeParse({ ...base, basePriceCop: 1000.5 }).success,
    ).toBe(false);
  });

  it("rechaza duración 0", () => {
    const r = serviceFormSchema.safeParse({ ...base, durationMin: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/mayor a 0/i);
  });

  it("rechaza duración negativa", () => {
    expect(
      serviceFormSchema.safeParse({ ...base, durationMin: -30 }).success,
    ).toBe(false);
  });

  it("exige nombre de al menos 2 caracteres", () => {
    expect(serviceFormSchema.safeParse({ ...base, name: "A" }).success).toBe(
      false,
    );
  });
});
