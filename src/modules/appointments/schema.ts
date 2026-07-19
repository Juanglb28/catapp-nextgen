import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { clients } from "@/modules/clients/schema";
import { services } from "@/modules/services/schema";
import { user } from "@/modules/tenancy/auth-schema";
import { tenants } from "@/modules/tenancy/schema";

export const appointmentStatus = pgEnum("appointment_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "partial",
  "paid",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "efectivo",
  "transferencia",
]);

/** Estado de la sincronización de la cita con Google Calendar (F5.B2). */
export const gcalSyncStatus = pgEnum("gcal_sync_status", [
  "ok",
  "pending",
  "error",
]);

/** Confirmación de la clienta desde la página pública de la cita. */
export const clientConfirmationStatus = pgEnum("client_confirmation_status", [
  "pending",
  "accepted",
  "rejected",
]);

/**
 * Citas. Multi-tenant: `tenant_id` y filtrado obligatorio (D-11).
 * Dinero en `bigint` COP. Fechas en `timestamptz` (UTC); la TZ del tenant solo
 * se aplica al presentar (D-05). `total_cop` admite override manual (D-10).
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("scheduled"),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    totalCop: bigint("total_cop", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    paidCop: bigint("paid_cop", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    tipCop: bigint("tip_cop", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    // Descuento por bono de cumpleaños aplicado a la cita (COP). 0 = sin bono.
    bonusDiscountCop: bigint("bonus_discount_cop", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    peopleCount: integer("people_count").notNull().default(1),
    notes: text("notes"),
    // Token público para la página de la clienta (D-07), sin login.
    publicToken: uuid("public_token").notNull().defaultRandom().unique(),
    // SEQUENCE del .ics (F4.B3): se incrementa al reagendar para que el
    // calendario de la clienta actualice el evento (mismo UID).
    sequence: integer("sequence").notNull().default(0),
    gcalEventId: text("gcal_event_id"),
    // Estado de la sync con Google Calendar (F5.B2). Null = sin conexión / no aplica.
    gcalSyncStatus: gcalSyncStatus("gcal_sync_status"),
    // Método de pago registrado (nullable: citas históricas sin dato).
    paymentMethod: paymentMethodEnum("payment_method"),
    // Confirmación de la clienta desde la página pública (F-nuevo).
    clientConfirmation: clientConfirmationStatus("client_confirmation")
      .notNull()
      .default("pending"),
    clientRejectionNote: text("client_rejection_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("appointments_tenant_starts_idx").on(t.tenantId, t.startsAt),
    // Historial por clienta (ficha) y stats: filtra tenant+client, ordena por fecha desc. (B0.1)
    index("appointments_tenant_client_starts_idx").on(
      t.tenantId,
      t.clientId,
      t.startsAt.desc(),
    ),
    // Crons cross-tenant (recordatorios): barren por rango de starts_at solo de las
    // agendadas. Índice parcial para no escanear completadas/canceladas. (B0.1)
    index("appointments_scheduled_starts_idx")
      .on(t.startsAt)
      .where(sql`${t.status} = 'scheduled'`),
  ],
);

/**
 * Servicios de una cita con el PRECIO CONGELADO al momento (D-10): si el
 * catálogo cambia luego, las citas pasadas no se alteran.
 */
export const appointmentServices = pgTable(
  "appointment_services",
  {
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    priceCop: bigint("price_cop", { mode: "bigint" }).notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.appointmentId, t.serviceId] })],
);

/** Auditoría de cambios de una cita (RF-02): una fila por campo modificado. */
export const appointmentChanges = pgTable(
  "appointment_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
  },
  // Historial de cambios de una cita: se lee por appointment_id ordenado por fecha. (B0.1)
  (t) => [
    index("appointment_changes_appointment_idx").on(
      t.appointmentId,
      t.changedAt,
    ),
  ],
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type AppointmentService = typeof appointmentServices.$inferSelect;
export type AppointmentChange = typeof appointmentChanges.$inferSelect;
