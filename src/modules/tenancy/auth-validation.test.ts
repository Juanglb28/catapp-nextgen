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
  const valid = {
    name: "Ana",
    email: "ana@correo.com",
    confirmEmail: "ana@correo.com",
    password: "12345678",
    confirmPassword: "12345678",
  };

  it("acepta datos válidos", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });
  it("rechaza contraseña corta (<8)", () => {
    const r = registerSchema.safeParse({
      ...valid,
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "password")).toBe(true);
    }
  });
  it("rechaza nombre corto (<2)", () => {
    expect(registerSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false,
    );
  });
  it("rechaza email inválido", () => {
    expect(
      registerSchema.safeParse({
        ...valid,
        email: "x",
        confirmEmail: "x",
      }).success,
    ).toBe(false);
  });
  it("rechaza si los correos no coinciden (warning en confirmEmail)", () => {
    const r = registerSchema.safeParse({
      ...valid,
      confirmEmail: "otra@correo.com",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "confirmEmail")).toBe(
        true,
      );
    }
  });
  it("rechaza si las contraseñas no coinciden (warning en confirmPassword)", () => {
    const r = registerSchema.safeParse({
      ...valid,
      confirmPassword: "87654321",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.path[0] === "confirmPassword"),
      ).toBe(true);
    }
  });
});
