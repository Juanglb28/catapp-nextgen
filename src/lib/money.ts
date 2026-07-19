/**
 * Dinero en CatApp: enteros `bigint` en pesos colombianos (COP), sin decimales.
 * Estos son los ÚNICOS helpers para formatear/parsear dinero. Prohibido hacerlo a mano.
 */

const COP_FORMAT = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea pesos a texto es-CO, p. ej. 50000n -> "$50.000". */
export function formatCOP(amount: bigint): string {
  // Intl intercala un espacio (NBSP) tras el símbolo ("$ 50.000"); lo quitamos.
  return COP_FORMAT.format(amount).replace(/\s/g, "");
}

/**
 * Convierte texto a pesos `bigint`, tolerante a "$", espacios y puntos de miles.
 * Lanza si no hay dígitos válidos.
 */
export function parseCOP(input: string): bigint {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 0) {
    throw new Error("Monto inválido");
  }
  const value = BigInt(digits);
  return negative ? -value : value;
}
