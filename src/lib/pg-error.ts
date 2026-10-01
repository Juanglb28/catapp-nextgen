/**
 * Extrae el error de PostgreSQL (con `code`, `constraint`, …) de una excepción
 * de base de datos. Desde drizzle-orm 0.44 los fallos de query llegan
 * envueltos en `DrizzleQueryError`, con el error original de `pg` en `cause`;
 * revisar solo `error.code` deja de funcionar. Se mira el error y su `cause`.
 */
export function getPgError(
  error: unknown,
): { code?: string; constraint?: string } | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth++) {
    if (typeof current !== "object" || current === null) return null;
    const e = current as Record<string, unknown>;
    if (typeof e["code"] === "string") {
      return {
        code: e["code"],
        constraint:
          typeof e["constraint"] === "string" ? e["constraint"] : undefined,
      };
    }
    current = e["cause"];
  }
  return null;
}
