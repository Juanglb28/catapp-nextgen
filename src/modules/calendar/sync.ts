import { swallow } from "@/lib/swallow";
import { getAppointment, setGcalSync } from "@/modules/appointments/repository";
import { getTenant } from "@/modules/tenancy/repository";

import {
  buildCalendarEvent,
  type CalendarEventBody,
  type SendUpdates,
} from "./event";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarAccess,
  updateCalendarEvent,
} from "./google";

/**
 * Sincronización CatApp → Google Calendar (F5.B2). El builder del evento vive en
 * `event.ts` (puro, testeable). `syncAppointment` es la máquina de estados: crea
 * / actualiza / borra el evento de forma idempotente y persiste `gcal_event_id`
 * + `gcal_sync_status`. El acceso a Google se inyecta (`port`) para testear sin
 * red.
 */

function appBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Puerto hacia Google Calendar; inyectable para tests. */
export type GoogleCalendarPort = {
  getAccess: (
    tenantId: string,
  ) => Promise<{ accessToken: string; calendarId: string } | null>;
  createEvent: (
    accessToken: string,
    calendarId: string,
    event: CalendarEventBody,
    sendUpdates: SendUpdates,
  ) => Promise<string>;
  updateEvent: (
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: CalendarEventBody,
    sendUpdates: SendUpdates,
  ) => Promise<"updated" | "notfound">;
  deleteEvent: (
    accessToken: string,
    calendarId: string,
    eventId: string,
    sendUpdates: SendUpdates,
  ) => Promise<void>;
};

const realPort: GoogleCalendarPort = {
  getAccess: getCalendarAccess,
  createEvent: createCalendarEvent,
  updateEvent: updateCalendarEvent,
  deleteEvent: deleteCalendarEvent,
};

/**
 * Sincroniza una cita con Google Calendar. No bloqueante por diseño (se llama
 * desde `after()`); cualquier fallo se registra como `gcal_sync_status = error`.
 * Si el tenant no tiene conexión activa o el sync está apagado, no hace nada.
 */
export async function syncAppointment(
  tenantId: string,
  appointmentId: string,
  opts: { invite?: boolean } = {},
  port: GoogleCalendarPort = realPort,
): Promise<void> {
  const access = await port.getAccess(tenantId);
  if (!access) return; // sin conexión o sync apagado: no-op.

  const appointment = await getAppointment(tenantId, appointmentId);
  if (!appointment) return;

  const { accessToken, calendarId } = access;

  try {
    // Cita cancelada o no asistió: borra el evento si existía.
    if (
      appointment.status === "cancelled" ||
      appointment.status === "no_show"
    ) {
      if (appointment.gcalEventId) {
        await port.deleteEvent(
          accessToken,
          calendarId,
          appointment.gcalEventId,
          "all",
        );
        await setGcalSync(tenantId, appointmentId, {
          gcalEventId: null,
          gcalSyncStatus: "ok",
        });
      }
      return;
    }

    const tenant = await getTenant(tenantId);
    const tz = tenant?.timezone ?? "America/Bogota";
    const attendeeEmail =
      opts.invite && appointment.client.email ? appointment.client.email : null;

    const event = buildCalendarEvent({
      clientName: appointment.client.name,
      services: appointment.services.map((s) => ({
        name: s.service.name,
        quantity: s.quantity,
      })),
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      timeZone: tz,
      detailUrl: `${appBaseUrl()}/citas/${appointmentId}`,
      attendeeEmail,
    });
    const sendUpdates: SendUpdates = attendeeEmail ? "all" : "none";

    if (appointment.gcalEventId) {
      const result = await port.updateEvent(
        accessToken,
        calendarId,
        appointment.gcalEventId,
        event,
        sendUpdates,
      );
      if (result === "notfound") {
        // El evento se borró a mano en Google: recrear (idempotencia).
        const newId = await port.createEvent(
          accessToken,
          calendarId,
          event,
          sendUpdates,
        );
        await setGcalSync(tenantId, appointmentId, {
          gcalEventId: newId,
          gcalSyncStatus: "ok",
        });
      } else {
        await setGcalSync(tenantId, appointmentId, { gcalSyncStatus: "ok" });
      }
    } else {
      const newId = await port.createEvent(
        accessToken,
        calendarId,
        event,
        sendUpdates,
      );
      await setGcalSync(tenantId, appointmentId, {
        gcalEventId: newId,
        gcalSyncStatus: "ok",
      });
    }
  } catch (err) {
    swallow(err, { module: "calendar", op: "syncAppointment", tenantId });
    await setGcalSync(tenantId, appointmentId, { gcalSyncStatus: "error" });
  }
}
