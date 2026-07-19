import { formatDateTime } from "@/lib/dates";

/**
 * Lógica de recordatorios automáticos (F8.B2). La ventana es de 20–28h en el
 * futuro: amplia para tolerar que el cron falle alguna corrida sin perder el
 * recordatorio (la idempotencia por `wa_messages` evita duplicados).
 */

export const REMINDER_WINDOW_FROM_H = 20;
export const REMINDER_WINDOW_TO_H = 28;

/** Rango UTC `[from, to)` de citas que deben recibir recordatorio ahora. */
export function reminderWindow(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() + REMINDER_WINDOW_FROM_H * 3_600_000),
    to: new Date(now.getTime() + REMINDER_WINDOW_TO_H * 3_600_000),
  };
}

/** True si una cita que empieza en `startsAt` cae en la ventana respecto a `now`. */
export function isWithinReminderWindow(startsAt: Date, now: Date): boolean {
  const { from, to } = reminderWindow(now);
  return startsAt >= from && startsAt < to;
}

/** Nombres de las plantillas aprobadas en Meta (configurables por env). */
export function reminderTemplateName(): string {
  return process.env.WA_TEMPLATE_REMINDER ?? "recordatorio";
}
export function confirmationTemplateName(): string {
  return process.env.WA_TEMPLATE_CONFIRMATION ?? "confirmacion";
}

function appBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/**
 * Parámetros del cuerpo de la plantilla (mismo orden para confirmación y
 * recordatorio): {{1}} nombre de pila, {{2}} fecha y hora en la TZ del tenant,
 * {{3}} link público de la cita. La plantilla en Meta debe respetar este orden.
 */
export function appointmentTemplateVariables(input: {
  clientName: string;
  startsAt: Date;
  timezone: string;
  publicToken: string;
}): string[] {
  const firstName = input.clientName.trim().split(/\s+/)[0] || input.clientName;
  const when = formatDateTime(input.startsAt, input.timezone);
  const link = `${appBaseUrl()}/cita/${input.publicToken}`;
  return [firstName, when, link];
}
