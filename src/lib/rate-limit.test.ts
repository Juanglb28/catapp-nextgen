import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientIp } from "./rate-limit";

/**
 * Rate limiter token-bucket en memoria (F10.B1) — capa anti-fuerza bruta.
 * El store es un Map a nivel de módulo, así que cada test usa una `key` única
 * para no contaminarse entre sí; el tiempo se controla con fake timers.
 */
describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta la capacidad y luego bloquea (429)", () => {
    const key = `login:${Math.random()}`;
    const cfg = { capacity: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, cfg)).toBe(true); // 1
    expect(checkRateLimit(key, cfg)).toBe(true); // 2
    expect(checkRateLimit(key, cfg)).toBe(true); // 3
    expect(checkRateLimit(key, cfg)).toBe(false); // agotado
    expect(checkRateLimit(key, cfg)).toBe(false); // sigue bloqueado
  });

  it("recarga tras pasar la ventana", () => {
    const key = `login:${Math.random()}`;
    const cfg = { capacity: 2, windowMs: 60_000 };
    expect(checkRateLimit(key, cfg)).toBe(true);
    expect(checkRateLimit(key, cfg)).toBe(true);
    expect(checkRateLimit(key, cfg)).toBe(false); // agotado

    vi.advanceTimersByTime(60_000); // una ventana completa
    expect(checkRateLimit(key, cfg)).toBe(true); // recargado
  });

  it("no recarga si aún no pasa la ventana completa", () => {
    const key = `login:${Math.random()}`;
    const cfg = { capacity: 1, windowMs: 60_000 };
    expect(checkRateLimit(key, cfg)).toBe(true);
    expect(checkRateLimit(key, cfg)).toBe(false);

    vi.advanceTimersByTime(59_999); // falta 1 ms
    expect(checkRateLimit(key, cfg)).toBe(false);
  });

  it("no acumula por encima de la capacidad tras varias ventanas ociosas", () => {
    const key = `login:${Math.random()}`;
    const cfg = { capacity: 2, windowMs: 60_000 };
    checkRateLimit(key, cfg); // consume 1 (queda 1)
    vi.advanceTimersByTime(60_000 * 10); // 10 ventanas ociosas
    // Cap = 2: solo 2 permitidos, no 1 + 10*2.
    expect(checkRateLimit(key, cfg)).toBe(true);
    expect(checkRateLimit(key, cfg)).toBe(true);
    expect(checkRateLimit(key, cfg)).toBe(false);
  });

  it("claves distintas tienen cubetas independientes", () => {
    const cfg = { capacity: 1, windowMs: 60_000 };
    const a = `login:${Math.random()}`;
    const b = `login:${Math.random()}`;
    expect(checkRateLimit(a, cfg)).toBe(true);
    expect(checkRateLimit(a, cfg)).toBe(false); // a agotado
    expect(checkRateLimit(b, cfg)).toBe(true); // b intacto
  });
});

describe("getClientIp", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(getClientIp(new Request("https://x", { headers }))).toBe("1.2.3.4");
  });

  it("recorta espacios de la IP", () => {
    const headers = new Headers({ "x-forwarded-for": "  5.6.7.8  " });
    expect(getClientIp(new Request("https://x", { headers }))).toBe("5.6.7.8");
  });

  it("devuelve 'unknown' si falta el header", () => {
    expect(getClientIp(new Request("https://x"))).toBe("unknown");
  });

  it("acepta un objeto tipo ReadonlyHeaders (Server Actions)", () => {
    const like = { get: (n: string) => (n === "x-forwarded-for" ? "9.9.9.9" : null) };
    expect(getClientIp(like)).toBe("9.9.9.9");
  });
});
