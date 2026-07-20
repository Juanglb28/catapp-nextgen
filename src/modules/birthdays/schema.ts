import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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

/**
 * Opciones de bono de cumpleaños CONFIGURABLES por tenant (D-19, B1.1). Reemplaza
 * el enum fijo `manicure/veloterapia` + las columnas `bonus_*_cop` del tenant, que
 * cableaban la feature a un negocio concreto. Cada tenant define sus propias
 * opciones (etiqueta + descuento en COP). Dinero en bigint (D-04).
 */
export const bonusOptions = pgTable(
  "bonus_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    discountCop: bigint("discount_cop", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bonus_options_tenant_active_idx").on(t.tenantId, t.active)],
);

export type BonusOption = typeof bonusOptions.$inferSelect;

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
    /** Opción elegida por la clienta (FK a bonus_options). set null si se borra. */
    chosenOptionId: uuid("chosen_option_id").references(() => bonusOptions.id, {
      onDelete: "set null",
    }),
    /** Snapshot de la etiqueta elegida (para mostrarla aunque la opción cambie/borre). */
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
