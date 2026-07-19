import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("America/Bogota"),
  currency: text("currency").notNull().default("COP"),
  // Datos públicos para la página de la clienta (F4.B1).
  publicAddress: text("public_address"),
  publicNote: text("public_note"),
  // Confirmaciones y recordatorios automáticos por WhatsApp (F8.B2).
  autoMessages: boolean("auto_messages").notNull().default(true),
  // Valor fijo (COP) de cada opción de bono de cumpleaños. 0 = sin configurar.
  bonusManicureCop: bigint("bonus_manicure_cop", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  bonusVeloterapiaCop: bigint("bonus_veloterapia_cop", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberRole = pgEnum("member_role", ["owner", "staff"]);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("memberships_user_tenant_unique").on(t.userId, t.tenantId)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
