import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isUnlockValid,
  makeUnlockToken,
  signPayload,
  verifyPayload,
} from "./app-lock";

describe("app-lock cookies firmadas", () => {
  it("firma y verifica un payload de ida y vuelta", () => {
    const token = signPayload({ a: 1, b: "x" });
    expect(verifyPayload<{ a: number; b: string }>(token)).toEqual({
      a: 1,
      b: "x",
    });
  });

  it("rechaza un payload con la firma manipulada", () => {
    const token = signPayload({ u: "user1" });
    const tampered = `${token.split(".")[0]}.AAAA`;
    expect(verifyPayload(tampered)).toBeNull();
  });

  it("rechaza entradas vacías o mal formadas", () => {
    expect(verifyPayload(undefined)).toBeNull();
    expect(verifyPayload("sin-punto")).toBeNull();
  });

  it("el token de desbloqueo solo vale para su usuario", () => {
    const token = makeUnlockToken("user1");
    expect(isUnlockValid(token, "user1")).toBe(true);
    expect(isUnlockValid(token, "otro")).toBe(false);
  });

  it("un token expirado no es válido", () => {
    const expired = signPayload({ u: "user1", exp: Date.now() - 1000 });
    expect(isUnlockValid(expired, "user1")).toBe(false);
  });

  it("fail-fast en producción si falta el secreto (RG-4)", () => {
    // Simula producción sin ningún secreto configurado (los "" son falsy).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("APP_LOCK_SECRET", "");
    expect(() => signPayload({ u: "user1" })).toThrow(/APP_LOCK_SECRET/);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
