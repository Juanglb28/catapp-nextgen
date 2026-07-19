import { describe, expect, it } from "vitest";

import { buildGoogleCalendarUrl, buildIcs, type CalendarEvent } from "./ics";

const base: CalendarEvent = {
  uid: "appt-123@catapp",
  // 2026-06-12 23:00 Bogotá (UTC-5) = 2026-06-13 04:00 UTC
  startsAt: new Date("2026-06-13T04:00:00Z"),
  endsAt: new Date("2026-06-13T05:00:00Z"),
  summary: "Cita en Uñas de Susana",
  description: "Servicios: Manicure. https://catapp.app/cita/abc",
  location: "Calle 1 #2-3",
  sequence: 0,
};

/** Parser mínimo de un VEVENT: devuelve un mapa propiedad -> valor. */
function parseVEvent(ics: string): Record<string, string> {
  const lines = ics.split("\r\n");
  expect(lines[0]).toBe("BEGIN:VCALENDAR");
  expect(lines).toContain("BEGIN:VEVENT");
  expect(lines).toContain("END:VEVENT");
  expect(lines[lines.length - 2]).toBe("END:VCALENDAR");
  const props: Record<string, string> = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") inEvent = true;
    else if (line === "END:VEVENT") inEvent = false;
    else if (inEvent) {
      const idx = line.indexOf(":");
      if (idx > 0) props[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
  return props;
}

describe("buildIcs", () => {
  it("genera un VEVENT válido con UTC correcto desde Bogotá", () => {
    const props = parseVEvent(buildIcs(base));
    expect(props.UID).toBe("appt-123@catapp");
    expect(props.SEQUENCE).toBe("0");
    expect(props.DTSTART).toBe("20260613T040000Z");
    expect(props.DTEND).toBe("20260613T050000Z");
    expect(props.SUMMARY).toBe("Cita en Uñas de Susana");
    expect(props.LOCATION).toBe("Calle 1 #2-3");
    expect(props.DTSTAMP).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("usa CRLF entre líneas", () => {
    expect(buildIcs(base)).toContain("\r\n");
  });

  it("escapa comas, punto y coma y saltos de línea", () => {
    const props = parseVEvent(
      buildIcs({
        ...base,
        summary: "Cita; con, coma\nlinea 2",
      }),
    );
    expect(props.SUMMARY).toBe("Cita\\; con\\, coma\\nlinea 2");
  });

  it("refleja el sequence (reagendamiento)", () => {
    const props = parseVEvent(buildIcs({ ...base, sequence: 3 }));
    expect(props.SEQUENCE).toBe("3");
  });

  it("omite DESCRIPTION/LOCATION si no vienen", () => {
    const ics = buildIcs({
      uid: "u",
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      summary: "x",
      sequence: 0,
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });
});

describe("buildGoogleCalendarUrl", () => {
  it("arma el enlace render con fechas UTC y datos codificados", () => {
    const url = new URL(buildGoogleCalendarUrl(base));
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render",
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Cita en Uñas de Susana");
    expect(url.searchParams.get("dates")).toBe(
      "20260613T040000Z/20260613T050000Z",
    );
    expect(url.searchParams.get("location")).toBe("Calle 1 #2-3");
  });
});
