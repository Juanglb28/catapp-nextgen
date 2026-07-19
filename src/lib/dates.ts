import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Fechas en CatApp: en DB se guardan como `timestamptz` (UTC). La zona horaria
 * del tenant (default America/Bogota) se aplica SOLO al presentar. Estos son los
 * únicos helpers de formateo; prohibido usar `toLocaleString()` suelto.
 */

export const DEFAULT_TZ = "America/Bogota";

/** Clave de día YYYY-MM-DD en la TZ del tenant (para fronteras de día/mes). */
export function tenantDayKey(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** Suma `days` a una clave YYYY-MM-DD (aritmética de calendario, no de horas). */
function addDaysToKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Desplaza una clave de día (YYYY-MM-DD) por `days` (puede ser negativo). */
export function shiftDayKey(dayKey: string, days: number): string {
  return addDaysToKey(dayKey, days);
}

/** Date "local de calendario" a partir de una clave (sin pasar por TZ). */
function dayKeyToLocalDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "miércoles 10 de junio" a partir de una clave de día. */
export function formatDayKeyLong(dayKey: string): string {
  return format(dayKeyToLocalDate(dayKey), "EEEE d 'de' MMMM", { locale: es });
}

/** Día de la semana abreviado ("mié") de una clave de día. */
export function formatDayKeyWeekday(dayKey: string): string {
  return format(dayKeyToLocalDate(dayKey), "EEE", { locale: es });
}

/** Número de día del mes (10) de una clave de día. */
export function dayKeyDayNumber(dayKey: string): number {
  return Number(dayKey.split("-")[2]);
}

/**
 * Rango UTC `[start, end)` que cubre el día `dayKey` (YYYY-MM-DD) en la TZ del
 * tenant. Correcto incluso con DST (usa la frontera del día siguiente, no +24h).
 * Ej.: una cita a las 23:00 de Bogotá cae dentro del día correcto.
 */
export function tenantDayRangeUtc(
  dayKey: string,
  tz: string = DEFAULT_TZ,
): { start: Date; end: Date } {
  const start = fromZonedTime(`${dayKey}T00:00:00`, tz);
  const end = fromZonedTime(`${addDaysToKey(dayKey, 1)}T00:00:00`, tz);
  return { start, end };
}

/**
 * Rango UTC `[start, end)` de un mes (year, month con month 1–12) en la TZ del
 * tenant. Un mes en America/Bogota NO es un mes en UTC, por eso las fronteras se
 * calculan en la zona del tenant (D-05). Se usa en finanzas (F6).
 */
export function tenantMonthRangeUtc(
  year: number,
  month: number,
  tz: string = DEFAULT_TZ,
): { start: Date; end: Date } {
  const startKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const start = fromZonedTime(`${startKey}T00:00:00`, tz);
  const end = fromZonedTime(`${endKey}T00:00:00`, tz);
  return { start, end };
}

/**
 * Convierte una fecha (YYYY-MM-DD) y hora (HH:mm) LOCALES de la TZ del tenant a
 * un instante UTC (`Date`). Inverso de presentar; se usa al agendar citas.
 */
export function tenantLocalToUtc(
  dayKey: string,
  timeHHmm: string,
  tz: string = DEFAULT_TZ,
): Date {
  return fromZonedTime(`${dayKey}T${timeHHmm}:00`, tz);
}

/** Hora "HH:mm" en la TZ del tenant para `date` (default: ahora). */
export function tenantTimeKey(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "HH:mm");
}

/** Próximo slot "HH:mm" redondeando hacia arriba a `stepMin` (default 15). */
export function tenantNextSlot(
  date: Date = new Date(),
  tz: string = DEFAULT_TZ,
  stepMin = 15,
): string {
  const [h, m] = tenantTimeKey(date, tz).split(":").map(Number);
  let mins = Math.ceil((h * 60 + m) / stepMin) * stepMin;
  if (mins >= 24 * 60) mins = 24 * 60 - stepMin;
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "miércoles 10 de junio de 2026" */
export function formatDateLong(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "EEEE d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
}

/** "mié 10 de jun" */
export function formatDateShort(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "EEE d 'de' MMM", { locale: es });
}

/** "9:00 p. m." */
export function formatTime(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "h:mm a", { locale: es });
}

/** "miércoles 10 de junio de 2026, 9:00 p. m." */
export function formatDateTime(date: Date, tz: string = DEFAULT_TZ): string {
  return `${formatDateLong(date, tz)}, ${formatTime(date, tz)}`;
}
