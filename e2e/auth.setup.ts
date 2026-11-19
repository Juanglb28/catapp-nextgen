import { expect, test as setup } from "@playwright/test";
import path from "path";

/**
 * Setup de autenticación para los E2E. Se ejecuta una sola vez antes de todos
 * los tests (proyecto "setup" en playwright.config.ts). Guarda la cookie de
 * sesión en e2e/.auth/session.json para que los specs la reutilicen.
 *
 * Requiere en .env (o variables de entorno):
 *   E2E_TEST_EMAIL    — correo del usuario de prueba
 *   E2E_TEST_PASSWORD — contraseña del usuario de prueba
 */

const SESSION_FILE = path.join(import.meta.dirname, ".auth/session.json");

setup("autenticar usuario de prueba", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Faltan E2E_TEST_EMAIL y/o E2E_TEST_PASSWORD en el entorno. " +
        "Agrégalos al .env para correr los E2E autenticados.",
    );
  }

  await page.goto("/login");

  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  // Esperar a que llegue a la app (redirige a /citas tras login exitoso).
  await expect(page).toHaveURL(/\/citas/, { timeout: 10_000 });

  // Guardar el estado de la sesión (cookies + localStorage).
  await page.context().storageState({ path: SESSION_FILE });
});
