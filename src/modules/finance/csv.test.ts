import { describe, expect, it } from "vitest";

import { buildFinanceCsv, type FinanceCsvRow } from "./csv";

const row = (over: Partial<FinanceCsvRow> = {}): FinanceCsvRow => ({
  fecha: "2026-07-10 15:00",
  clienta: "Ana",
  servicios: "Manicure",
  total: "50000",
  pagado: "50000",
  saldo: "0",
  estado: "Completada",
  ...over,
});

describe("buildFinanceCsv", () => {
  it("empieza con BOM UTF-8 (U+FEFF)", () => {
    expect(buildFinanceCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it("incluye los encabezados", () => {
    expect(buildFinanceCsv([])).toContain(
      "Fecha,Clienta,Servicios,Total,Pagado,Saldo,Estado",
    );
  });

  it("usa CRLF y escribe una fila simple sin comillas", () => {
    const csv = buildFinanceCsv([row()]);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")[1]).toBe(
      "2026-07-10 15:00,Ana,Manicure,50000,50000,0,Completada",
    );
  });

  it("entrecomilla campos con coma", () => {
    expect(
      buildFinanceCsv([row({ servicios: "Manicure, Pedicure" })]),
    ).toContain('"Manicure, Pedicure"');
  });

  it("duplica las comillas internas (RFC 4180)", () => {
    expect(buildFinanceCsv([row({ clienta: 'Ana "La Jefa"' })])).toContain(
      '"Ana ""La Jefa"""',
    );
  });

  it("entrecomilla saltos de línea y punto y coma", () => {
    expect(buildFinanceCsv([row({ servicios: "a\nb" })])).toContain('"a\nb"');
    expect(buildFinanceCsv([row({ servicios: "a;b" })])).toContain('"a;b"');
  });

  it("preserva tildes y emojis", () => {
    expect(buildFinanceCsv([row({ clienta: "Ramírez 😊" })])).toContain(
      "Ramírez 😊",
    );
  });

  it("termina en CRLF", () => {
    expect(buildFinanceCsv([row()]).endsWith("\r\n")).toBe(true);
  });
});
