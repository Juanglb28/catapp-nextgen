import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "@/modules/tenancy/schema";

/**
 * Catálogo de servicios del negocio. Multi-tenant: cada fila pertenece a un
 * `tenant_id` y TODA query del repositorio filtra por él (D-11).
 *
 * `basePriceCop` es un entero `bigint` en pesos colombianos (sin decimales,
 * regla de dinero). Los servicios no se borran: se desactivan (`active=false`)
 * porque las citas históricas pueden referenciarlos.
 */
export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Precio base en pesos (entero, ≥ 0). `mode: "bigint"` => valor JS BigInt.
    basePriceCop: bigint("base_price_cop", { mode: "bigint" }).notNull(),
    durationMin: integer("duration_min").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("services_tenant_active_idx").on(t.tenantId, t.active)],
);

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
