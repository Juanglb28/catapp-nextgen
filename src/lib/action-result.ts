/**
 * Resultado unificado de las Server Actions (B4/R-C2). Antes cada módulo definía
 * su propio `ActionResult` (8 copias divergentes: unas con `data`, otras sin).
 * Este tipo único sirve a ambos usos sin romper el código existente:
 *
 *  - `ActionResult` (T = undefined): acepta tanto `{ ok: true }` como
 *    `{ ok: true, data: undefined }` — para acciones sin valor de retorno.
 *  - `ActionResult<{ id: string }>`: exige `data` — para acciones que devuelven
 *    algo al cliente.
 *
 * El condicional en `T` hace que `data` sea opcional solo cuando no hay payload,
 * así la migración no toca ningún `return { ok: true }` existente.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

/** Éxito sin datos: `ok()`. Con datos: `ok(data)`. */
export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data } as ActionResult<T>;
}

/** Fallo con mensaje para mostrar a la usuaria (ya en es-CO). */
export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
