import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "@/modules/tenancy/schema";

/**
 * Clientas del negocio. Multi-tenant: cada fila pertenece a un `tenant_id` y
 * TODA query del repositorio filtra por él (ver repository-base.ts, D-11).
 *
 * Borrado lógico: las clientas no se eliminan (las citas históricas las
 * referencian); `archivedAt` marca las archivadas.
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Teléfono en E.164 (+57XXXXXXXXXX); se normaliza antes de persistir.
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    // Fecha de cumpleaños (solo día/mes; year opcional). Tipo `date` sin TZ.
    // Formato "YYYY-MM-DD" al leer; year 1900 = se desconoce el año.
    birthdayDate: date("birthday_date"),
    // ID del evento de Google Calendar del cumpleaños (para actualizarlo sin duplicar).
    birthdayGcalEventId: text("birthday_gcal_event_id"),
    // Opt-out de mensajes automáticos por WhatsApp (F8.B2). Los manuales (wa.me)
    // no lo consultan: los envía la manicurista desde su propio teléfono.
    waOptOut: boolean("wa_opt_out").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("clients_tenant_name_idx").on(t.tenantId, t.name),
    // Un teléfono E.164 es único por tenant (previene clientas duplicadas).
    uniqueIndex("clients_tenant_phone_unique").on(t.tenantId, t.phone),
    // Cron de cumpleaños (cross-tenant): busca por mes/día de birthday_date. Índice
    // de expresión parcial para no escanear clientas sin cumpleaños ni archivadas. (B0.1)
    index("clients_birthday_month_day_idx")
      .on(
        sql`EXTRACT(MONTH FROM ${t.birthdayDate})`,
        sql`EXTRACT(DAY FROM ${t.birthdayDate})`,
      )
      .where(
        sql`${t.birthdayDate} IS NOT NULL AND ${t.archivedAt} IS NULL`,
      ),
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
