-- B0 + B1(parte 1) · Cambios de esquema consolidados en una sola migración.
-- Contenido:
--   B0.1  índices de rendimiento (historial de clienta, crons, cambios)
--   B0.2  unique de idempotencia en wa_messages (con dedupe previo)
--   B1.2  eliminación del rol de membresía (D-20): drop columna role + enum
--
-- Migración sobre la MISMA DB de producción (D-21): requiere BACKUP previo.
-- Los índices son aditivos; el DROP COLUMN/TYPE es contract (destructivo pero
-- seguro: el código ya no referencia `role`).
--
-- Nota Postgres: la expresión EXTRACT(... FROM ...) en un CREATE INDEX DEBE ir
-- entre paréntesis propios, o da "syntax error at or near FROM".
--
-- Reversa:
--   DROP INDEX "appointment_changes_appointment_idx",
--     "appointments_tenant_client_starts_idx",
--     "appointments_scheduled_starts_idx", "clients_birthday_month_day_idx";
--   ALTER TABLE "wa_messages" DROP CONSTRAINT "wa_messages_appointment_template_unique";
--   CREATE TYPE "public"."member_role" AS ENUM('owner','staff');
--   ALTER TABLE "memberships" ADD COLUMN "role" "public"."member_role" NOT NULL DEFAULT 'owner';

-- Dedupe previo (B0.2): el unique (appointment_id, template_name) fallaría si el
-- código antiguo (check-then-insert, carrera QA B5) dejó duplicados. Conserva la
-- fila más antigua por (appointment_id, template_name). Solo afecta filas con
-- appointment_id NOT NULL (las NULL no colisionan en el unique).
DELETE FROM "wa_messages" a
USING "wa_messages" b
WHERE a."appointment_id" IS NOT NULL
  AND a."appointment_id" = b."appointment_id"
  AND a."template_name" = b."template_name"
  AND (a."created_at" > b."created_at"
       OR (a."created_at" = b."created_at" AND a."id" > b."id"));
--> statement-breakpoint
CREATE INDEX "appointment_changes_appointment_idx" ON "appointment_changes" USING btree ("appointment_id","changed_at");--> statement-breakpoint
CREATE INDEX "appointments_tenant_client_starts_idx" ON "appointments" USING btree ("tenant_id","client_id","starts_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "appointments_scheduled_starts_idx" ON "appointments" USING btree ("starts_at") WHERE "appointments"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "clients_birthday_month_day_idx" ON "clients" USING btree ((EXTRACT(MONTH FROM "birthday_date")),(EXTRACT(DAY FROM "birthday_date"))) WHERE "clients"."birthday_date" IS NOT NULL AND "clients"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_appointment_template_unique" UNIQUE("appointment_id","template_name");--> statement-breakpoint
DROP TYPE "public"."member_role";
