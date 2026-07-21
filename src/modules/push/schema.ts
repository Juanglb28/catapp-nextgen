import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "@/modules/tenancy/schema";

/**
 * Suscripciones Web Push por tenant (B4/R-C3). Antes vivían en el módulo
 * `birthdays` (acoplamiento H-02/H-8): el push no es de cumpleaños, lo usan
 * también citas y el cron. Es la MISMA tabla `push_subscriptions` — solo cambia
 * de archivo, sin migración.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("push_subscriptions_tenant_idx").on(t.tenantId)],
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
