-- Método de pago por cita: efectivo o transferencia bancaria (nullable: datos históricos sin método).
CREATE TYPE "payment_method" AS ENUM ('efectivo', 'transferencia');
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "payment_method" "payment_method";
