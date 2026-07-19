import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Configuración E2E (Playwright). Requiere instalar la dependencia y los
 * navegadores: `pnpm install && pnpm exec playwright install chromium`.
 * Levanta la app en producción contra la DB local (con migraciones aplicadas).
 * Correr: `pnpm test:e2e`.
 *
 * Variables de entorno necesarias para los tests de auth/a11y (añadir al .env):
 *   E2E_TEST_EMAIL    — correo del usuario de prueba
 *   E2E_TEST_PASSWORD — contraseña del usuario de prueba
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    // 1. Setup: hace login una vez y guarda la cookie en e2e/.auth/session.json.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 2. Principal: viewport móvil Pixel 7 (412px, Chromium).
    //    devices["iPhone 14"] requiere WebKit; usamos Pixel 7 (Chromium) que
    //    está dentro del rango objetivo 360–430px y ya se verificó que funciona.
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        storageState: "e2e/.auth/session.json",
      },
      dependencies: ["setup"],
    },
    // 3. Secundario: desktop Chrome (regresión de layout).
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/session.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
