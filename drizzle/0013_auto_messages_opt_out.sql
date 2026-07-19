ALTER TABLE "clients" ADD COLUMN "wa_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "auto_messages" boolean DEFAULT true NOT NULL;