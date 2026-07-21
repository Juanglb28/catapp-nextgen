import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Rate limiting durable en Postgres (B3.3, R-B7). Una sola sentencia atómica
 * (INSERT … ON CONFLICT) incrementa el contador de la ventana o lo reinicia si
 * la ventana venció, tomando el lock de fila en el conflicto: dos requests
 * concurrentes con la misma `key` no se pisan.
 */

export type RateLimitResult = {
  /** `true` si el request está permitido; `false` si superó el límite (429). */
  allowed: boolean;
  /** Segundos hasta que la ventana se reinicia (para el header Retry-After). */
  retryAfterSec: number;
};

/**
 * Consume un intento de la ventana de `key`. Permitido si el conteo tras el
 * incremento es ≤ `limit`.
 *
 * Fail-open: si la DB falla, permite el request. El rate-limit es una defensa
 * secundaria; no debe tumbar el login/endpoint si el store no responde.
 */
export async function consumeRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const windowSecs = opts.windowMs / 1000;
  try {
    const res = await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSecs})
          THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE
          WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSecs})
          THEN now() ELSE rate_limits.window_start END
      RETURNING count,
        extract(epoch from (window_start + make_interval(secs => ${windowSecs}) - now())) AS retry_after
    `);
    const row = (res.rows[0] ?? { count: 1, retry_after: windowSecs }) as {
      count: number | string;
      retry_after: number | string;
    };
    const count = Number(row.count);
    const retryAfterSec = Math.max(1, Math.ceil(Number(row.retry_after)));
    return { allowed: count <= opts.limit, retryAfterSec };
  } catch (err) {
    // No se loguea la `key` cruda (contiene IP/userId): solo el prefijo (RNF-03).
    logger.error("rate-limit store unavailable; failing open", {
      module: "rate-limit",
      op: "consume",
      bucket: key.split(":")[0],
      err,
    });
    return { allowed: true, retryAfterSec: 0 };
  }
}

/**
 * Borra las filas cuya ventana venció hace más de `olderThanMs`. Housekeeping
 * opcional (el store no crece sin control a esta escala, pero un cron lo puede
 * llamar). No es necesario para la corrección del límite.
 */
export async function pruneRateLimits(olderThanMs = 86_400_000): Promise<void> {
  const secs = olderThanMs / 1000;
  try {
    await db.execute(
      sql`DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => ${secs})`,
    );
  } catch (err) {
    logger.error("rate-limit prune failed", {
      module: "rate-limit",
      op: "prune",
      err,
    });
  }
}
