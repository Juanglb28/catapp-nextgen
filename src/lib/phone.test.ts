import { describe, expect, it } from "vitest";

import { formatPhoneCO, normalizePhone, normalizePhoneCO } from "./phone";

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

describe("normalizePhone", () => {
  it("prioriza el formato colombiano (sin +)", () => {
    expect(normalizePhone("3001234567")).toBe("+573001234567");
  });
  it("acepta un celular de EE.UU. con +1", () => {
    expect(normalizePhone("+1 202 555 0123")).toBe("+12025550123");
  });
  it("acepta un E.164 internacional con guiones y paréntesis", () => {
    expect(normalizePhone("+1 (202) 555-0123")).toBe("+12025550123");
  });
  it("acepta otros indicativos internacionales", () => {
    expect(normalizePhone("+34 612 345 678")).toBe("+34612345678");
  });
  it("rechaza un número internacional sin +", () => {
    expect(normalizePhone("12025550123")).toBeNull();
  });
  it("rechaza un E.164 demasiado corto", () => {
    expect(normalizePhone("+1234")).toBeNull();
  });
  it("rechaza un E.164 demasiado largo", () => {
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });
  it("rechaza vacío", () => {
    expect(normalizePhone("")).toBeNull();
  });
});
