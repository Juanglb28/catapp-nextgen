-- B0.1 + B0.2 · Índices de rendimiento y constraint de idempotencia de WhatsApp.
-- Migración ADITIVA (expand): no altera datos existentes salvo el dedupe previo.
-- Reversa: DROP INDEX de los 4 índices + ALTER TABLE wa_messages DROP CONSTRAINT
--          "wa_messages_appointment_template_unique". Ver ROLLBACK_PLAN.md.
--
-- Nota: en una DB de producción con volumen, considerar crear los índices con
-- CREATE INDEX CONCURRENTLY fuera de transacción (drizzle-kit los corre en
-- transacción). A la escala actual (un tenant, pocos miles de filas) el bloqueo
-- es instantáneo.

-- Dedupe previo (B0.2): el unique (appointment_id, template_name) fallaría si el
-- código antiguo (check-then-insert, carrera QA B5) dejó duplicados. Conserva la
-- fila más antigua por (appointment_id, template_name) y borra el resto. Solo
-- afecta filas con appointment_id NOT NULL (las NULL no colisionan en el unique).
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
CREATE INDEX "clients_birthday_month_day_idx" ON "clients" USING btree (EXTRACT(MONTH FROM "birthday_date"),EXTRACT(DAY FROM "birthday_date")) WHERE "clients"."birthday_date" IS NOT NULL AND "clients"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_appointment_template_unique" UNIQUE("appointment_id","template_name");
