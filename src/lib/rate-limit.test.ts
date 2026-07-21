import { afterEach, describe, expect, it } from "vitest";

import { getClientIp } from "./rate-limit";

/**
 * `getClientIp` toma la IP del **último hop confiable** de `x-forwarded-for`
 * (B3.3), no el primer valor (que el cliente puede falsificar). El store durable
 * del rate-limit se prueba en el test de integración de `modules/rate-limit`.
 */
describe("getClientIp", () => {
  const original = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = original;
  });

  it("toma el último valor de XFF (hop de confianza), ignorando el que finge el cliente", () => {
    // El cliente falsifica 1.2.3.4; Railway añade la IP real al final.
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" });
    expect(getClientIp(new Request("https://x", { headers }))).toBe("9.9.9.9");
  });

  it("con una sola IP la devuelve tal cual (recortando espacios)", () => {
    const headers = new Headers({ "x-forwarded-for": "  5.6.7.8  " });
    expect(getClientIp(new Request("https://x", { headers }))).toBe("5.6.7.8");
  });

  it("respeta TRUSTED_PROXY_HOPS>1 (varios proxies de confianza)", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    // cliente, proxyA, proxyB → con 2 hops de confianza la IP del cliente es la
    // penúltima ("real") y la última es de infraestructura.
    const headers = new Headers({
      "x-forwarded-for": "spoof, real, infra",
    });
    expect(getClientIp(new Request("https://x", { headers }))).toBe("real");
  });

  it("devuelve 'unknown' si falta el header", () => {
    expect(getClientIp(new Request("https://x"))).toBe("unknown");
  });

  it("acepta un objeto tipo ReadonlyHeaders (Server Actions)", () => {
    const like = {
      get: (n: string) => (n === "x-forwarded-for" ? "9.9.9.9" : null),
    };
    expect(getClientIp(like)).toBe("9.9.9.9");
  });
});
