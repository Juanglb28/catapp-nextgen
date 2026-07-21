import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Rate limiting durable (B3.3, R-B7). Reemplaza el Map en memoria por instancia:
 * el store en Postgres sobrevive reinicios/redeploys (un atacante no resetea su
 * cuota forzando un deploy) y es correcto con >1 réplica. Ventana fija por `key`
 * (p. ej. "auth:1.2.3.4", "applock:<userId>"): `count` de intentos desde
 * `window_start`; al vencer la ventana el contador se reinicia atómicamente.
 * No lleva `tenant_id`: la clave es por IP o por usuario, transversal a tenants.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RateLimitRow = typeof rateLimits.$inferSelect;
