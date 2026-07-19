import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appointments } from "@/modules/appointments/schema";
import { clients } from "@/modules/clients/schema";
import { tenants } from "@/modules/tenancy/schema";

export const birthdayBonusStatus = pgEnum("birthday_bonus_status", [
  "pending_manicurist",
  "approved",
  "chosen",
  "redeemed",
  "declined",
]);

export type BirthdayBonusOption =
  | "manicure_tradicional"
  | "veloterapia_exfoliacion";

export const BIRTHDAY_OPTION_LABELS: Record<BirthdayBonusOption, string> = {
  manicure_tradicional: "Manicure tradicional",
  veloterapia_exfoliacion: "Veloterapia con exfoliación",
};

/**
 * Un bono de cumpleaños por clienta y año.
 * `public_token` = URL sin login para que la clienta escoja su servicio.
 */
export const birthdayBonuses = pgTable(
  "birthday_bonuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    year: integer("year").notNull(),
    status: birthdayBonusStatus("status")
      .notNull()
      .default("pending_manicurist"),
    /** 'manicure_tradicional' | 'veloterapia_exfoliacion' — se llena al elegir */
    chosenOption: text("chosen_option"),
    publicToken: uuid("public_token").notNull().defaultRandom(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("birthday_bonuses_tenant_status_idx").on(t.tenantId, t.status),
    uniqueIndex("birthday_bonuses_public_token_idx").on(t.publicToken),
    // Un solo bono por clienta/año (evita duplicados del cron)
    uniqueIndex("birthday_bonuses_client_year_idx").on(t.clientId, t.year),
  ],
);

export type BirthdayBonus = typeof birthdayBonuses.$inferSelect;

/** Suscripciones Web Push por tenant. */
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
