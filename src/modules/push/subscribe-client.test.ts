import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "./subscribe-client";

/**
 * Decodifica la VAPID public key (base64url) al `Uint8Array` que exige la Push
 * API. Un error aquí rompe silenciosamente la suscripción en el dispositivo.
 */
describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url estándar", () => {
    // "hola" en base64 = "aG9sYQ==" → bytes [104,111,108,97]
    const out = urlBase64ToUint8Array("aG9sYQ");
    expect(Array.from(out)).toEqual([104, 111, 108, 97]);
  });

  it("traduce los caracteres url-safe - y _ a + y /", () => {
    // 0xFB 0xFF → base64 "-/8=" en url-safe usa '-' y '_'.
    const std = urlBase64ToUint8Array("+/8=");
    const urlSafe = urlBase64ToUint8Array("-_8");
    expect(Array.from(urlSafe)).toEqual(Array.from(std));
    expect(Array.from(urlSafe)).toEqual([251, 255]);
  });

  it("agrega el padding faltante", () => {
    // Sin '=' de relleno debe decodificar igual.
    expect(Array.from(urlBase64ToUint8Array("YQ"))).toEqual([97]); // "a"
    expect(Array.from(urlBase64ToUint8Array("YWI"))).toEqual([97, 98]); // "ab"
  });

  it("produce la longitud típica de una VAPID key (65 bytes)", () => {
    // 65 bytes → 87 chars base64url sin padding.
    const key = "B".repeat(86) + "g";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
