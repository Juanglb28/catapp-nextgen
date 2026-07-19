-- Bono de cumpleaños por clienta/año. Unique (client_id, year) garantiza idempotencia.
CREATE TYPE "birthday_bonus_status" AS ENUM (
  'pending_manicurist',
  'approved',
  'chosen',
  'redeemed',
  'declined'
);

CREATE TABLE "birthday_bonuses" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "client_id"      uuid NOT NULL REFERENCES "clients"("id"),
  "year"           integer NOT NULL,
  "status"         "birthday_bonus_status" NOT NULL DEFAULT 'pending_manicurist',
  -- 'manicure_tradicional' | 'veloterapia_exfoliacion'
  "chosen_option"  text,
  -- Token público para la pantalla de la clienta (sin login)
  "public_token"   uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Cita en la que se redimió el bono
  "appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("client_id", "year")
);

CREATE INDEX "birthday_bonuses_tenant_status_idx" ON "birthday_bonuses" ("tenant_id", "status");
CREATE UNIQUE INDEX "birthday_bonuses_public_token_idx" ON "birthday_bonuses" ("public_token");

-- Suscripciones Web Push por tenant (para notificaciones de cumpleaños).
CREATE TABLE "push_subscriptions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "endpoint"   text NOT NULL UNIQUE,
  "p256dh"     text NOT NULL,
  "auth"       text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "push_subscriptions_tenant_idx" ON "push_subscriptions" ("tenant_id");
