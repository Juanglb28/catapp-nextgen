import { swallow } from "@/lib/swallow";

import type { CalendarEventBody, SendUpdates } from "./event";
import { getGoogleAccount, getRefreshToken, markBroken } from "./repository";

/**
 * Cliente de Google OAuth + Calendar vía REST (F5.B1). Se eligió REST directo
 * en lugar de la librería `googleapis` para no añadir una dependencia pesada y
 * mantener el bundle liviano; solo se usan unos pocos endpoints.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_LIST_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList";

function eventsUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId,
  )}/events`;
}

/** Scopes para Google Calendar (conexión principal desde /ajustes). */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

/**
 * Scopes adicionales para importar contactos.
 * Se solicitan en el flujo separado /api/google/connect-contacts,
 * DESPUÉS de que el usuario ya conectó Calendar, para reutilizar la cuenta.
 * contacts.readonly es un scope sensible que requiere verificación de Google;
 * separarlo evita que bloquee el flujo principal de Calendar.
 */
export const GOOGLE_CONTACTS_SCOPES = [
  ...GOOGLE_SCOPES,
  "https://www.googleapis.com/auth/contacts.readonly",
];

/** Error específico cuando Google revocó el acceso (refresh_token inválido). */
export class InvalidGrantError extends Error {
  constructor() {
    super("invalid_grant");
    this.name = "InvalidGrantError";
  }
}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

export function redirectUri(baseUrl: string): string {
  return `${baseUrl}/api/google/callback`;
}

/** URL del consentimiento de Google (con offline + prompt=consent). */
export function buildAuthUrl(
  baseUrl: string,
  state: string,
  scopes: string[] = GOOGLE_SCOPES,
): string {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    // No include_granted_scopes: con prompt=consent el flujo siempre es
    // completo; incluirlo arrastra scopes de sesiones anteriores (contacts)
    // aunque no los pidamos, lo que bloquea el flujo con 403.
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Intercambia el código por tokens y obtiene el correo de Google. */
export async function exchangeCode(
  baseUrl: string,
  code: string,
): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const { clientId, clientSecret } = config();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Intercambio de código falló: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  if (!data.refresh_token) {
    throw new Error(
      "Google no devolvió refresh_token (revoca el acceso y reintenta).",
    );
  }
  const email = await getUserEmail(data.access_token);
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    email,
  };
}

/** Renueva el access_token con el refresh_token. Lanza InvalidGrantError si fue revocado. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<string> {
  const { clientId, clientSecret } = config();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new InvalidGrantError();
    throw new Error(`No se pudo renovar el token: ${data.error ?? res.status}`);
  }
  return data.access_token;
}

async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo leer el correo de Google.");
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

export type GoogleCalendarSummary = {
  id: string;
  name: string;
  primary: boolean;
};

/** Lista los calendarios del usuario (para elegir el destino). */
export async function listCalendars(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  const res = await fetch(`${CALENDAR_LIST_URL}?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudieron listar los calendarios.");
  const data = (await res.json()) as {
    items?: { id: string; summary: string; primary?: boolean }[];
  };
  return (data.items ?? []).map((c) => ({
    id: c.id,
    name: c.summary,
    primary: c.primary ?? false,
  }));
}

/** Revoca un token contra Google (al desconectar). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch (err) {
    // Si la revocación falla, igual borramos la fila local.
    swallow(err, { module: "calendar", op: "revokeToken" });
  }
}

/**
 * Devuelve un access_token válido ignorando el toggle de sync. Lo usa la UI de
 * ajustes para listar los calendarios aunque la sincronización esté pausada.
 * Null si no hay token o Google revocó el acceso (marca la conexión rota).
 */
export async function getAccessTokenForSettings(
  tenantId: string,
): Promise<string | null> {
  const refreshToken = await getRefreshToken(tenantId);
  if (!refreshToken) return null;
  try {
    return await refreshAccessToken(refreshToken);
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      await markBroken(tenantId);
      return null;
    }
    throw error;
  }
}

/**
 * Devuelve un access_token válido y el calendario destino del tenant para usar
 * la API de Calendar (F5.B2). Null si no hay conexión activa o el sync está
 * apagado. Si Google revocó el acceso, marca la conexión como rota.
 */
export async function getCalendarAccess(
  tenantId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const account = await getGoogleAccount(tenantId);
  if (!account || account.status !== "connected" || !account.syncEnabled) {
    return null;
  }
  const refreshToken = await getRefreshToken(tenantId);
  if (!refreshToken) return null;
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    return { accessToken, calendarId: account.calendarId };
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      await markBroken(tenantId);
      return null;
    }
    throw error;
  }
}

/** Crea un evento y devuelve su id. */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEventBody,
  sendUpdates: SendUpdates = "none",
): Promise<string> {
  const res = await fetch(
    `${eventsUrl(calendarId)}?sendUpdates=${sendUpdates}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  if (!res.ok) {
    throw new Error(`No se pudo crear el evento: ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Actualiza un evento existente con PATCH (actualización parcial): solo cambia
 * los campos enviados, por lo que NO borra asistentes ya invitados si el cuerpo
 * no los incluye. Devuelve "notfound" si Google responde 404/410 (el evento fue
 * borrado a mano) para que el llamador lo recree (idempotencia).
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: CalendarEventBody,
  sendUpdates: SendUpdates = "none",
): Promise<"updated" | "notfound"> {
  const res = await fetch(
    `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  if (res.status === 404 || res.status === 410) return "notfound";
  if (!res.ok) {
    throw new Error(`No se pudo actualizar el evento: ${res.status}`);
  }
  return "updated";
}

// ---------------------------------------------------------------------------
// Google People API (contactos — contacts.readonly)
// ---------------------------------------------------------------------------

const PEOPLE_API_URL = "https://people.googleapis.com/v1/people/me/connections";

export type GoogleContact = {
  resourceName: string;
  names?: { displayName: string }[];
  phoneNumbers?: { value: string }[];
  emailAddresses?: { value: string }[];
  birthdays?: {
    /** year puede ser 0 o ausente cuando el usuario no lo registró */
    date?: { year?: number; month: number; day: number };
    text?: string;
  }[];
};

/**
 * Obtiene todos los contactos del usuario vía Google People API.
 * Pagina automáticamente; se detiene al llegar a 1 000 contactos.
 */
export async function fetchGoogleContacts(
  accessToken: string,
): Promise<GoogleContact[]> {
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: "names,phoneNumbers,emailAddresses,birthdays",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${PEOPLE_API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`People API ${res.status}: ${body}`);
    }
    const data = (await res.json()) as {
      connections?: GoogleContact[];
      nextPageToken?: string;
    };
    contacts.push(...(data.connections ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && contacts.length < 1000);

  return contacts;
}

// ---------------------------------------------------------------------------
// Birthday event helpers
// ---------------------------------------------------------------------------

/**
 * Crea (o actualiza) un evento anual de cumpleaños en Google Calendar.
 * Usa RRULE:FREQ=YEARLY para que se repita cada año.
 * `birthdayDate` = "YYYY-MM-DD".
 */
export async function upsertBirthdayCalendarEvent(
  accessToken: string,
  calendarId: string,
  clientName: string,
  birthdayDate: string,
  existingEventId?: string | null,
): Promise<string> {
  const [, month, day] = birthdayDate.split("-");
  // Google Calendar all-day events use YYYY-MM-DD; year must match the first occurrence.
  const year = new Date().getFullYear();
  const dateStr = `${year}-${month}-${day}`;

  const event = {
    summary: `🎂 Cumpleaños de ${clientName}`,
    start: { date: dateStr },
    end: { date: dateStr },
    recurrence: ["RRULE:FREQ=YEARLY"],
    transparency: "transparent",
  };

  if (existingEventId) {
    const result = await updateCalendarEvent(
      accessToken,
      calendarId,
      existingEventId,
      event,
    );
    if (result === "updated") return existingEventId;
  }

  return createCalendarEvent(accessToken, calendarId, event);
}

/** Borra un evento. 404/410 (ya no existe) se considera éxito. */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  sendUpdates: SendUpdates = "none",
): Promise<void> {
  const res = await fetch(
    `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw new Error(`No se pudo borrar el evento: ${res.status}`);
}
