import {
  boolean,
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
  // Los valores de bono ya NO viven aquí: son opciones por tenant en
  // `bonus_options` (D-19, B1.1). Columnas bonus_*_cop eliminadas en 0026.
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Rol de membresía eliminado (D-20, B1.2): el negocio es de una sola persona
// (owner). No había ningún control que distinguiera owner/staff, así que el enum
// solo daba una falsa sensación de permisos (06-SEG H-02). La tabla memberships
// se conserva como relación user↔tenant; la columna `role` y el enum `member_role`
// se eliminan en la migración 0025 (consolidada).
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("memberships_user_tenant_unique").on(t.userId, t.tenantId)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
