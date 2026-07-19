-- Backfill (data-only, sin cambio de esquema).
-- Corrige el bug histórico en el que `applyBirthdayBonusAction` aplicaba el
-- descuento del bono pero NO lo redimía: el bono quedaba atascado en 'chosen'
-- y podía reutilizarse. Aquí marcamos como 'redeemed' los bonos 'chosen' cuya
-- clienta ya tiene una cita con descuento de bono aplicado (bonus_discount_cop > 0),
-- enlazando la cita descontada más reciente de esa clienta.
UPDATE "birthday_bonuses" AS bb
SET "status" = 'redeemed',
    "appointment_id" = sub."id",
    "updated_at" = now()
FROM (
  SELECT DISTINCT ON (a."tenant_id", a."client_id")
         a."id", a."tenant_id", a."client_id"
  FROM "appointments" AS a
  WHERE a."bonus_discount_cop" > 0
  ORDER BY a."tenant_id", a."client_id", a."starts_at" DESC
) AS sub
WHERE bb."status" = 'chosen'
  AND bb."tenant_id" = sub."tenant_id"
  AND bb."client_id" = sub."client_id";
