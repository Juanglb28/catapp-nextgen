/**
 * Token-bucket rate limiter — in-memory, per process instance (F10.B1).
 *
 * Trade-offs (documented in DECISIONES.md):
 *  - Works correctly on Railway's single Node.js process.
 *  - On multi-instance deployments each instance has an independent bucket;
 *    an attacker can spread requests across instances. Migrate the store to
 *    Redis/Upstash when horizontal scaling is needed.
 *  - The store is a module-level Map, so it persists for the lifetime of the
 *    process (no TTL cleanup). Memory impact is negligible at this scale
 *    (one entry ≈ 60 bytes; 10 000 unique IPs ≈ 600 KB).
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Module-level store: survives across requests within the same Node.js process.
const store = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Maximum number of tokens (burst capacity). Default: 10. */
  capacity?: number;
  /** Tokens restored per window. Default: equals capacity. */
  refillAmount?: number;
  /** Refill window in milliseconds. Default: 60_000 (1 min). */
  windowMs?: number;
}

/**
 * Checks whether `key` is allowed to proceed.
 *
 * Returns `true` (allowed) or `false` (rate limited / 429).
 *
 * @param key   Unique key, e.g. `"login:1.2.3.4"` or `"public-cita:1.2.3.4"`.
 */
export function checkRateLimit(
  key: string,
  { capacity = 10, refillAmount, windowMs = 60_000 }: RateLimitConfig = {},
): boolean {
  const fill = refillAmount ?? capacity;
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket) {
    // First request from this key: grant immediately, start with capacity - 1.
    store.set(key, { tokens: capacity - 1, lastRefill: now });
    return true;
  }

  // Refill: restore `fill` tokens per elapsed window.
  const windowsElapsed = Math.floor((now - bucket.lastRefill) / windowMs);
  const restored = Math.min(capacity, bucket.tokens + windowsElapsed * fill);
  const lastRefill = windowsElapsed > 0 ? now : bucket.lastRefill;

  if (restored <= 0) {
    store.set(key, { tokens: restored, lastRefill });
    return false; // rate limited
  }

  store.set(key, { tokens: restored - 1, lastRefill });
  return true; // allowed
}

/** Minimal interface satisfied by both `Request.headers` and Next.js `ReadonlyHeaders`. */
interface HeadersLike {
  get(name: string): string | null;
}

/**
 * Extract the client IP address.
 *
 * Accepts either a `Request` object (route handlers) or the `ReadonlyHeaders`
 * returned by `next/headers` (Server Components / Server Actions).
 * Railway sets `x-forwarded-for` with the real client IP.
 */
export function getClientIp(source: Request | HeadersLike): string {
  const hdrs =
    source instanceof Request ? source.headers : (source as HeadersLike);
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
