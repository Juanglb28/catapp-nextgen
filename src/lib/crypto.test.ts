import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

const KEY = "clave-de-prueba-muy-secreta-123456";

describe("crypto (AES-256-GCM)", () => {
  it("round-trip: descifrar lo cifrado devuelve el original", () => {
    const secret = "1//0gRefreshTokenDeGoogle_con_ñ_y_emoji_😊";
    const enc = encryptSecret(secret, KEY);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc, KEY)).toBe(secret);
  });

  it("el cifrado es distinto cada vez (IV aleatorio)", () => {
    const a = encryptSecret("token", KEY);
    const b = encryptSecret("token", KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe("token");
    expect(decryptSecret(b, KEY)).toBe("token");
  });

  it("una clave distinta no puede descifrar (falla)", () => {
    const enc = encryptSecret("token", KEY);
    expect(() => decryptSecret(enc, "otra-clave-distinta")).toThrow();
  });

  it("un texto cifrado manipulado falla la verificación", () => {
    const enc = encryptSecret("token", KEY);
    const [iv, tag] = enc.split(":");
    const tampered = [iv, tag, Buffer.from("hackeado").toString("base64")].join(
      ":",
    );
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it("sin clave lanza error claro", () => {
    expect(() => encryptSecret("x", undefined)).toThrow(/GOOGLE_TOKEN_KEY/);
  });
});
