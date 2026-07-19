import { describe, expect, it } from "vitest";

import { formatPhoneCO, normalizePhoneCO } from "./phone";

describe("normalizePhoneCO", () => {
  it("normaliza 10 dígitos", () => {
    expect(normalizePhoneCO("3001234567")).toBe("+573001234567");
  });
  it("acepta espacios", () => {
    expect(normalizePhoneCO("300 123 4567")).toBe("+573001234567");
  });
  it("acepta prefijo +57", () => {
    expect(normalizePhoneCO("+57 300 123 4567")).toBe("+573001234567");
  });
  it("acepta prefijo 57 sin +", () => {
    expect(normalizePhoneCO("573001234567")).toBe("+573001234567");
  });
  it("acepta paréntesis y guiones", () => {
    expect(normalizePhoneCO("(300) 123-4567")).toBe("+573001234567");
  });
  it("rechaza fijos (no empiezan por 3)", () => {
    expect(normalizePhoneCO("6012345678")).toBeNull();
  });
  it("rechaza longitud incorrecta", () => {
    expect(normalizePhoneCO("30012345")).toBeNull();
  });
  it("rechaza vacío", () => {
    expect(normalizePhoneCO("")).toBeNull();
  });
});

describe("formatPhoneCO", () => {
  it("formatea E.164 legible", () => {
    expect(formatPhoneCO("+573001234567")).toBe("+57 300 123 4567");
  });
});
