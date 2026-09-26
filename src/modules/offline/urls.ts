import { shiftDayKey } from "@/lib/dates";

import { OFFLINE_AGENDA_DAYS, OFFLINE_MAX_DETAIL_PAGES } from "./constants";

/**
 * URLs que el teléfono descarga por adelantado para consultarlas sin conexión
 * (D-35): agenda de hoy + 7 días, las vistas de la agenda, la lista de
 * clientas y el detalle de cada cita (y su clienta) de esos días.
 */
export function buildOfflineUrls(
  today: string,
  appts: { id: string; clientId: string }[],
): string[] {
  const days = Array.from({ length: OFFLINE_AGENDA_DAYS }, (_, i) =>
    shiftDayKey(today, i),
  );
  const base = [
    "/citas",
    ...days.map((d) => `/citas?date=${d}`),
    "/citas?view=semana",
    "/citas?view=proximas",
    "/citas?view=pendientes",
    "/clientas",
  ];
  const details: string[] = [];
  const seenClients = new Set<string>();
  for (const a of appts) {
    details.push(`/citas/${a.id}`);
    if (!seenClients.has(a.clientId)) {
      seenClients.add(a.clientId);
      details.push(`/clientas/${a.clientId}`);
    }
  }
  return [...base, ...details.slice(0, OFFLINE_MAX_DETAIL_PAGES)];
}
