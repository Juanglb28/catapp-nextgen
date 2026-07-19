/**
 * Generador de CSV del export financiero (F6.B2). Puro: recibe filas ya
 * formateadas (strings) y devuelve el CSV. Antepone BOM UTF-8 para que Excel
 * abra bien las tildes, usa CRLF y escapa comas/comillas/saltos según RFC 4180.
 */

/** BOM UTF-8: hace que Excel detecte la codificación y muestre tildes. */
const BOM = "﻿";

export const FINANCE_CSV_HEADERS = [
  "Fecha",
  "Clienta",
  "Servicios",
  "Total",
  "Pagado",
  "Saldo",
  "Estado",
] as const;

export type FinanceCsvRow = {
  fecha: string;
  clienta: string;
  servicios: string;
  total: string;
  pagado: string;
  saldo: string;
  estado: string;
};

/** Escapa un campo: lo entrecomilla si tiene coma, comilla, ; o salto de línea. */
function csvField(value: string): string {
  if (/[",;\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Arma el CSV completo (con BOM) a partir de las filas. */
export function buildFinanceCsv(rows: FinanceCsvRow[]): string {
  const body = rows.map((r) => [
    r.fecha,
    r.clienta,
    r.servicios,
    r.total,
    r.pagado,
    r.saldo,
    r.estado,
  ]);
  const csv = [FINANCE_CSV_HEADERS as readonly string[], ...body]
    .map((cols) => cols.map(csvField).join(","))
    .join("\r\n");
  return `${BOM}${csv}\r\n`;
}
