/**
 * Tipos y builder PURO del evento de Google Calendar (F5.B2). Sin dependencias
 * de DB ni de red para que sea trivial de testear y para romper el ciclo de
 * imports con `google.ts` (que sí toca el repositorio).
 */

/** Cuerpo de un evento de Google Calendar (subset que usamos). */
export type CalendarEventBody = {
  summary: string;
  description?: string;
  /** Evento con hora exacta (citas) o todo-el-día (cumpleaños). */
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  recurrence?: string[];
  transparency?: string;
  attendees?: { email: string }[];
};

/** `all` envía invitaciones por correo a los asistentes; `none` no notifica. */
export type SendUpdates = "all" | "none";

export type BuildEventInput = {
  clientName: string;
  services: { name: string; quantity: number }[];
  startsAt: Date;
  endsAt: Date;
  /** TZ del tenant (D-05), ej. America/Bogota. */
  timeZone: string;
  /** URL del detalle interno de la cita (requiere login). */
  detailUrl: string;
  /** Correo de la clienta si se la invita; si no, sin asistentes. */
  attendeeEmail?: string | null;
};

function servicesLabel(services: { name: string; quantity: number }[]): string {
  return services
    .map((s) => (s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name))
    .join(", ");
}

/** Tipo narrowed para eventos con hora exacta (lo que construye buildCalendarEvent). */
export type TimedCalendarEvent = Omit<CalendarEventBody, "start" | "end"> & {
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

/** Construye el cuerpo del evento de Google Calendar. Puro. */
export function buildCalendarEvent(input: BuildEventInput): TimedCalendarEvent {
  const label = servicesLabel(input.services);
  const summary = label
    ? `💅 ${input.clientName} — ${label}`
    : `💅 ${input.clientName}`;

  const event: TimedCalendarEvent = {
    summary,
    description: `Cita agendada en CatApp.\nVer detalle: ${input.detailUrl}`,
    start: {
      dateTime: input.startsAt.toISOString(),
      timeZone: input.timeZone,
    },
    end: {
      dateTime: input.endsAt.toISOString(),
      timeZone: input.timeZone,
    },
  };
  if (input.attendeeEmail) {
    event.attendees = [{ email: input.attendeeEmail }];
  }
  return event;
}
