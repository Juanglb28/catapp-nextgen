import {
  bigint,
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "@/modules/tenancy/auth-schema";
import { tenants } from "@/modules/tenancy/schema";

/**
 * Inventario (F7.B1). Multi-tenant: `tenant_id` y filtrado obligatorio (D-11).
 * El stock es `numeric(12,2)` (admite ml/gr con decimales) y SOLO cambia vía
 * `registerMovement` (D-9): la suma de movimientos == stock actual, siempre.
 * `cost_cop` es dinero → `bigint` COP. Las cantidades NO son dinero.
 */

export const stockMovementType = pgEnum("stock_movement_type", [
  "in",
  "out",
  "adjust",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("unidad"),
    stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
    minStock: numeric("min_stock", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    costCop: bigint("cost_cop", { mode: "bigint" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_tenant_active_idx").on(t.tenantId, t.active)],
);

/**
 * Movimientos de stock. `quantity` para 'in'/'out' es la magnitud (positiva);
 * para 'adjust' guarda el DELTA aplicado (con signo), no el valor final.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("stock_movements_tenant_product_idx").on(
      t.tenantId,
      t.productId,
      t.createdAt,
    ),
  ],
);

export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type StockMovementType = (typeof stockMovementType.enumValues)[number];
