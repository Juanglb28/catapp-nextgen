CREATE TYPE "public"."gcal_sync_status" AS ENUM('ok', 'pending', 'error');--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "gcal_sync_status" "gcal_sync_status";