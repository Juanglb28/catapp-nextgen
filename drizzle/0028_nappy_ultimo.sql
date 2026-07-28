ALTER TABLE "appointments" ADD COLUMN "cash_cop" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "transfer_cop" bigint DEFAULT 0 NOT NULL;