-- B1.1 · Bonos de cumpleaños configurables por catálogo (D-19).
-- Reemplaza el enum fijo manicure/veloterapia + columnas tenants.bonus_*_cop por
-- una tabla `bonus_options` por tenant. Incluye MIGRACIÓN DE DATOS: convierte los
-- valores fijos existentes en filas de bonus_options y enlaza los bonos ya elegidos.
--
-- Migración sobre la MISMA DB de producción (D-21): requiere BACKUP previo.
-- Orden: crear estructura → migrar datos → (contract) eliminar columnas viejas.
--
-- Reversa (aditiva primero; el drop de columnas es lo único no trivial):
--   ALTER TABLE "tenants" ADD COLUMN "bonus_manicure_cop" bigint NOT NULL DEFAULT 0;
--   ALTER TABLE "tenants" ADD COLUMN "bonus_veloterapia_cop" bigint NOT NULL DEFAULT 0;
--   (repoblar desde bonus_options si se desea) ;
--   ALTER TABLE "birthday_bonuses" DROP COLUMN "chosen_option_id";
--   DROP TABLE "bonus_options";

CREATE TABLE "bonus_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"discount_cop" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "birthday_bonuses" ADD COLUMN "chosen_option_id" uuid;--> statement-breakpoint
ALTER TABLE "bonus_options" ADD CONSTRAINT "bonus_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bonus_options_tenant_active_idx" ON "bonus_options" USING btree ("tenant_id","active");--> statement-breakpoint
ALTER TABLE "birthday_bonuses" ADD CONSTRAINT "birthday_bonuses_chosen_option_id_bonus_options_id_fk" FOREIGN KEY ("chosen_option_id") REFERENCES "public"."bonus_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Migración de datos (B1.1): valores fijos del tenant → opciones. Solo > 0.
INSERT INTO "bonus_options" ("tenant_id","label","discount_cop","active")
  SELECT "id", 'Manicure tradicional', "bonus_manicure_cop", true
  FROM "tenants" WHERE "bonus_manicure_cop" > 0;
--> statement-breakpoint
INSERT INTO "bonus_options" ("tenant_id","label","discount_cop","active")
  SELECT "id", 'Veloterapia con exfoliación', "bonus_veloterapia_cop", true
  FROM "tenants" WHERE "bonus_veloterapia_cop" > 0;
--> statement-breakpoint
-- Enlazar los bonos ya elegidos con su opción migrada (por etiqueta) y dejar el
-- snapshot de la etiqueta en chosen_option (antes tenía la clave del enum).
UPDATE "birthday_bonuses" b SET "chosen_option_id" = o."id"
  FROM "bonus_options" o
  WHERE o."tenant_id" = b."tenant_id"
    AND (
      (b."chosen_option" = 'manicure_tradicional'   AND o."label" = 'Manicure tradicional') OR
      (b."chosen_option" = 'veloterapia_exfoliacion' AND o."label" = 'Veloterapia con exfoliación')
    );
--> statement-breakpoint
UPDATE "birthday_bonuses" SET "chosen_option" = CASE
    WHEN "chosen_option" = 'manicure_tradicional'   THEN 'Manicure tradicional'
    WHEN "chosen_option" = 'veloterapia_exfoliacion' THEN 'Veloterapia con exfoliación'
    ELSE "chosen_option"
  END
  WHERE "chosen_option" IS NOT NULL;
--> statement-breakpoint

-- Contract: eliminar las columnas fijas ya migradas.
ALTER TABLE "tenants" DROP COLUMN "bonus_manicure_cop";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "bonus_veloterapia_cop";
