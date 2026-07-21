import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { closeDb, TEST_DB } from "@/test/db-harness";

/**
 * Store durable del rate-limit contra Postgres real (B3.3). Cada test usa una
 * `key` única, así que no necesita TRUNCATE de `rate_limits`. Requiere
 * `TEST_DATABASE_URL`.
 */
describe.runIf(TEST_DB)("rate-limit durable (integración)", () => {
  afterAll(async () => {
    await closeDb();
  });

  async function consume(key: string, opts: { limit: number; windowMs: number }) {
    const { consumeRateLimit } = await import("./repository");
    return consumeRateLimit(key, opts);
  }

  it("permite hasta el límite y luego bloquea (429) con Retry-After", async () => {
    const key = `test:${randomUUID()}`;
    const opts = { limit: 3, windowMs: 60_000 };
    expect((await consume(key, opts)).allowed).toBe(true); // 1
    expect((await consume(key, opts)).allowed).toBe(true); // 2
    expect((await consume(key, opts)).allowed).toBe(true); // 3
    const blocked = await consume(key, opts);
    expect(blocked.allowed).toBe(false); // 4 → 429
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("claves distintas tienen cubetas independientes", async () => {
    const a = `test:${randomUUID()}`;
    const b = `test:${randomUUID()}`;
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await consume(a, opts)).allowed).toBe(true);
    expect((await consume(a, opts)).allowed).toBe(false); // a agotado
    expect((await consume(b, opts)).allowed).toBe(true); // b intacto
  });

  it("reinicia el contador cuando vence la ventana", async () => {
    const key = `test:${randomUUID()}`;
    const opts = { limit: 1, windowMs: 300 };
    expect((await consume(key, opts)).allowed).toBe(true);
    expect((await consume(key, opts)).allowed).toBe(false); // dentro de la ventana
    await new Promise((r) => setTimeout(r, 350)); // vence la ventana
    expect((await consume(key, opts)).allowed).toBe(true); // reiniciado
  });
});
