CREATE TYPE "public"."client_confirmation_status" AS ENUM('pending', 'accepted', 'rejected');
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD COLUMN "client_confirmation" "client_confirmation_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN "client_rejection_note" text;
