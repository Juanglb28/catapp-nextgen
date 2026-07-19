/**
 * Reglas de dominio de citas — funciones PURAS, sin acceso a DB.
 * Dinero en `bigint` (pesos COP); fechas en `Date` (UTC).
 */

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "pending" | "partial" | "paid";

/** Línea de servicio de una cita (precio congelado). */
export type ServiceLine = { priceCop: bigint; quantity: number };

/**
 * Estado de pago derivado del total a cobrar y lo pagado:
 * - total <= 0 (nada por cobrar, p. ej. bono que cubre todo) -> paid
 * - pagado 0  -> pending
 * - 0 < pagado < total -> partial
 * - pagado >= total (y > 0) -> paid
 */
export function derivePaymentStatus(
  totalCop: bigint,
  paidCop: bigint,
): PaymentStatus {
  if (totalCop <= 0n) return "paid";
  if (paidCop <= 0n) return "pending";
  if (paidCop < totalCop) return "partial";
  return "paid";
}

/**
 * Total de la cita: suma de `precio * cantidad` de cada servicio, salvo que se
 * pase un `override` explícito (negociación en vivo, RF-02), que manda.
 */
export function computeTotal(
  lines: ServiceLine[],
  override?: bigint | null,
): bigint {
  if (override !== undefined && override !== null) return override;
  return lines.reduce(
    (sum, line) => sum + line.priceCop * BigInt(line.quantity),
    0n,
  );
}

/** Una cita es válida en el tiempo si termina estrictamente después de empezar. */
export function validateTimeRange(startsAt: Date, endsAt: Date): boolean {
  return endsAt.getTime() > startsAt.getTime();
}

/**
 * Una cita queda "bloqueada" (solo lectura, salvo registrar pagos) cuando está
 * cancelada. Las citas completadas SÍ permiten edición posterior (RF-07).
 */
export function isLocked(status: string): boolean {
  return status === "cancelled";
}
