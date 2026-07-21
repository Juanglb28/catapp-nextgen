/**
 * Utilidades de rate limiting (B3.3, R-B7). El *store* durable vive en
 * `@/modules/rate-limit/repository` (`consumeRateLimit`) — aquí solo queda la
 * extracción de la IP del cliente, que es lógica pura sin acceso a datos.
 */

/** Minimal interface satisfied by both `Request.headers` and Next.js `ReadonlyHeaders`. */
interface HeadersLike {
  get(name: string): string | null;
}

/**
 * Extrae la IP del cliente desde `x-forwarded-for` usando el **último hop
 * confiable** (B3.3, antes se tomaba el primer valor, que el cliente puede
 * falsificar). El proxy de Railway antepone la cadena XFF y añade la IP real de
 * quien se conecta a él como el valor MÁS A LA DERECHA; un `X-Forwarded-For`
 * enviado por el atacante queda a la izquierda y se ignora.
 *
 * `TRUSTED_PROXY_HOPS` (default 1) = número de proxies de confianza delante de la
 * app; la IP del cliente está a esa distancia del final de la lista.
 *
 * Acepta un `Request` (route handlers) o los `ReadonlyHeaders` de `next/headers`
 * (Server Components / Server Actions).
 */
export function getClientIp(source: Request | HeadersLike): string {
  const hdrs =
    source instanceof Request ? source.headers : (source as HeadersLike);
  const xff = hdrs.get("x-forwarded-for");
  if (!xff) return "unknown";

  const parts = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "unknown";

  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1"));
  // Con `hops` proxies de confianza, la IP del cliente está a `hops` posiciones
  // desde el final. Si la lista es más corta que `hops`, caemos al primer valor.
  const idx = parts.length - hops;
  return parts[idx] ?? parts[0];
}
