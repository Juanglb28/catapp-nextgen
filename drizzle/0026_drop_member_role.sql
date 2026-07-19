-- B1.2 · Elimina el rol de membresía (D-20): el negocio es de una sola persona
-- (owner) y no había ningún control que distinguiera owner/staff, así que el enum
-- solo daba una falsa sensación de permisos (06-SEGURIDAD H-02).
--
-- Migración CONTRACT (destructiva): elimina la columna `role` (siempre 'owner' en
-- la práctica) y el tipo enum. Segura porque el código ya no la referencia (B1.2).
-- Requiere BACKUP Railway previo (D-21, misma DB de producción).
--
-- Reversa:
--   CREATE TYPE "public"."member_role" AS ENUM('owner','staff');
--   ALTER TABLE "memberships" ADD COLUMN "role" "public"."member_role"
--     NOT NULL DEFAULT 'owner';
ALTER TABLE "memberships" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."member_role";
