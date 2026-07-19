import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "@/modules/tenancy/schema";

export const googleAccountStatus = pgEnum("google_account_status", [
  "connected",
  "broken",
]);

/**
 * Conexión de Google Calendar por tenant (F5.B1). Una por tenant
 * (`tenant_id` unique). El `refresh_token` se guarda CIFRADO (AES-256-GCM).
 * Si Google revoca el acceso (invalid_grant), `status` pasa a 'broken'.
 */
export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),
  googleEmail: text("google_email").notNull(),
  // refresh_token cifrado (nunca en claro).
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  status: googleAccountStatus("status").notNull().default("connected"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GoogleAccount = typeof googleAccounts.$inferSelect;
