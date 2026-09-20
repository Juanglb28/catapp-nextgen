/**
 * Push de recordatorio de cobro (D-32): citas completadas con saldo pendiente
 * con antigüedad >= 1 día calendario. La lógica genérica de envío vive en
 * @/lib/push y @/modules/push/send.
 */
import type { PushPayload } from "@/lib/push";
import { formatDateShort } from "@/lib/dates";

/** Destino de la notificación: la tab "Pendientes" de /citas (D-29). */
export const OVERDUE_PAYMENTS_URL = "/citas?view=pendientes";

/**
 * Payload del recordatorio de cobro. Con una sola cita nombra a la clienta;
 * con varias resume el conteo y la fecha de la más antigua.
 */
export function overduePaymentsPushPayload(input: {
  count: number;
  oldestClientName: string;
  oldestStartsAt: Date;
  timezone: string;
}): PushPayload {
  const { count, oldestClientName, oldestStartsAt, timezone } = input;
  const fecha = formatDateShort(oldestStartsAt, timezone);

  if (count === 1) {
    const firstName =
      oldestClientName.trim().split(/\s+/)[0] || oldestClientName;
    return {
      title: "💰 Cobro pendiente",
      body: `La cita de ${firstName} del ${fecha} sigue sin cobrarse. Toca para ver el saldo.`,
      url: OVERDUE_PAYMENTS_URL,
    };
  }

  return {
    title: `💰 Tienes ${count} citas sin cobrar`,
    body: `La más antigua es del ${fecha}. Toca para revisar los cobros pendientes.`,
    url: OVERDUE_PAYMENTS_URL,
  };
}
