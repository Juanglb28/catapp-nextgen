ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "bonus_discount_cop" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "bonus_manicure_cop" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "bonus_veloterapia_cop" bigint DEFAULT 0 NOT NULL;
