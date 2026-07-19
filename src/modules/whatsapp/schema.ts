import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { appointments } from "@/modules/appointments/schema";
import { tenants } from "@/modules/tenancy/schema";

/**
 * Textos personalizables de WhatsApp por tenant (F4.B2). Si un tenant no tiene
 * fila para una `key`, se usa el texto por defecto de `templates.ts`.
 */
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    text: text("text").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("message_templates_tenant_key_unique").on(t.tenantId, t.key)],
);

export type MessageTemplate = typeof messageTemplates.$inferSelect;

/** Estados de un mensaje enviado por la Cloud API (F8.B1). */
export const waMessageStatus = pgEnum("wa_message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);

/**
 * Registro de cada mensaje enviado por WhatsApp Cloud API (F8.B1). TODO envío
 * pasa por aquí: primero `queued`, luego se actualiza según la respuesta de la
 * API y los webhooks de estado. Sirve también de marca de idempotencia (no
 * reenviar el mismo recordatorio a la misma cita).
 */
export const waMessages = pgTable(
  "wa_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    toPhone: text("to_phone").notNull(),
    templateName: text("template_name").notNull(),
    status: waMessageStatus("status").notNull().default("queued"),
    waMessageId: text("wa_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("wa_messages_tenant_appointment_idx").on(t.tenantId, t.appointmentId),
    index("wa_messages_wa_message_id_idx").on(t.waMessageId),
  ],
);

export type WaMessage = typeof waMessages.$inferSelect;
export type WaMessageStatus = (typeof waMessageStatus.enumValues)[number];
