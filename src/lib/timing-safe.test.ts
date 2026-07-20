import { describe, expect, it } from "vitest";

import { constantTimeEqual } from "./timing-safe";

/**
 * Comparación en tiempo constante de secretos (B0.6). Protege el Bearer del cron
 * y el verify token de WhatsApp frente a timing attacks. Aquí verificamos la
 * corrección funcional; la propiedad de tiempo constante la garantiza
 * `node:crypto.timingSafeEqual`.
 */
describe("constantTimeEqual", () => {
  it("es true para strings idénticos", () => {
    expect(constantTimeEqual("Bearer s3cr3t", "Bearer s3cr3t")).toBe(true);
  });

  it("es false para strings distintos de igual longitud", () => {
    expect(constantTimeEqual("Bearer aaaaa", "Bearer bbbbb")).toBe(false);
  });

  it("es false cuando difieren en longitud", () => {
    expect(constantTimeEqual("corto", "mucho-mas-largo")).toBe(false);
  });

  it("es false ante null/undefined en cualquier lado", () => {
    expect(constantTimeEqual(null, "x")).toBe(false);
    expect(constantTimeEqual("x", null)).toBe(false);
    expect(constantTimeEqual(undefined, undefined)).toBe(false);
    expect(constantTimeEqual(null, null)).toBe(false);
  });

  it("no confunde el string vacío con un secreto real", () => {
    expect(constantTimeEqual("", "Bearer s3cr3t")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("maneja UTF-8 multibyte por bytes, no por caracteres", () => {
    // "é" ocupa 2 bytes; distinto largo en bytes que "e".
    expect(constantTimeEqual("café", "café")).toBe(true);
    expect(constantTimeEqual("café", "cafe")).toBe(false);
  });
});
