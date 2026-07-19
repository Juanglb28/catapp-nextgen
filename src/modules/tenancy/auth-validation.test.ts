import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth-validation";

describe("loginSchema", () => {
  it("acepta credenciales válidas", () => {
    expect(
      loginSchema.safeParse({ email: "ana@correo.com", password: "x" }).success,
    ).toBe(true);
  });
  it("rechaza email inválido", () => {
    expect(
      loginSchema.safeParse({ email: "no-es-email", password: "x" }).success,
    ).toBe(false);
  });
  it("rechaza contraseña vacía", () => {
    expect(
      loginSchema.safeParse({ email: "ana@correo.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("registerSchema", () => {
  it("acepta datos válidos", () => {
    expect(
      registerSchema.safeParse({
        name: "Ana",
        email: "ana@correo.com",
        password: "12345678",
      }).success,
    ).toBe(true);
  });
  it("rechaza contraseña corta (<8)", () => {
    const r = registerSchema.safeParse({
      name: "Ana",
      email: "ana@correo.com",
      password: "1234567",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "password")).toBe(true);
    }
  });
  it("rechaza nombre corto (<2)", () => {
    expect(
      registerSchema.safeParse({
        name: "A",
        email: "ana@correo.com",
        password: "12345678",
      }).success,
    ).toBe(false);
  });
  it("rechaza email inválido", () => {
    expect(
      registerSchema.safeParse({
        name: "Ana",
        email: "x",
        password: "12345678",
      }).success,
    ).toBe(false);
  });
});
