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
