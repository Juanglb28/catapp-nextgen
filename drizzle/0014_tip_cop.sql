-- Agrega columna tip_cop para registrar propinas separadas de los pagos por servicios.
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "tip_cop" bigint DEFAULT 0 NOT NULL;
