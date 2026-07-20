// Antes de CUALQUIER import de módulos de la app: si hay una base de test,
// apunta DATABASE_URL a ella. Algunos archivos de integración importan `@/lib/db`
// de forma estática (al cargar), antes de que el arnés fije DATABASE_URL; sin
// esto, su pool se crea sin URL y falla con "SASL: client password must be a
// string". setupFiles corre antes que los imports del archivo de test (B2.4).
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Shim del `after()` de Next para los tests (B2.4). Fuera de un request real,
 * `after()` lanza "after was called outside a request scope". En los tests de
 * integración probamos el efecto DIRECTO de las Server Actions (escrituras a la
 * DB); los side-effects encolados con `after()` (sync a Google Calendar, push)
 * se prueban por separado en sus propios módulos. Aquí `after` es un no-op
 * seguro: no lanza y no dispara efectos externos. El resto de `next/server`
 * (NextResponse, etc.) queda intacto.
 */
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});
