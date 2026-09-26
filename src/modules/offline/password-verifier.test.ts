import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

import { checkPassword, createPasswordVerifier } from "./password-verifier";

// Iteraciones bajas solo para que el test sea rápido; en la app se usa el default.
const ITER = 1_000;
const c = webcrypto as unknown as Crypto;

describe("password-verifier (PBKDF2 local, D-35)", () => {
  it("valida la contraseña correcta y rechaza otra", async () => {
    const v = await createPasswordVerifier("Secreta#123", "u1", c, ITER);
    expect(await checkPassword("Secreta#123", v, c)).toBe(true);
    expect(await checkPassword("secreta#123", v, c)).toBe(false);
    expect(await checkPassword("", v, c)).toBe(false);
  });

  it("no guarda la contraseña y usa sal distinta cada vez", async () => {
    const a = await createPasswordVerifier("Secreta#123", null, c, ITER);
    const b = await createPasswordVerifier("Secreta#123", null, c, ITER);
    expect(JSON.stringify(a)).not.toContain("Secreta");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(a.userId).toBeNull();
  });
});
