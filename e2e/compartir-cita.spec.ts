import { expect, test } from "@playwright/test";

/**
 * E2E del flujo de compartir (F4.B1): desde el detalle de una cita, obtener
 * el public_token interceptando el clic del botón Compartir y verificar que
 * la página pública /cita/<token> no expone datos sensibles.
 *
 * Requiere sesión de prueba (e2e/.auth/session.json) y al menos una cita
 * en la DB local.
 *
 * Nota: navigator.clipboard solo está disponible en contextos seguros (HTTPS /
 * localhost). En HTTP remoto lo mockeamos con addInitScript antes de navegar.
 */
test.describe("compartir cita", () => {
  test("la página pública /cita/<token> no muestra datos sensibles", async ({
    page,
    browser,
  }) => {
    // 1. Inyectar mock de clipboard ANTES de cualquier navegación.
    //    En HTTP remoto navigator.clipboard es undefined; lo creamos nosotros.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            (window as typeof window & { __copiedUrl?: string }).__copiedUrl =
              text;
            return Promise.resolve();
          },
          readText: async () => Promise.resolve(""),
        },
        configurable: true,
        writable: true,
      });
      // Deshabilitar navigator.share para forzar el fallback al clipboard.
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });

    // 2. Ir a la agenda y abrir la primera cita de detalle.
    await page.goto("/citas");
    await page.waitForLoadState("networkidle");

    const firstCard = page
      .locator("a[href^='/citas/']:not([href='/citas/nueva'])")
      .first();
    if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "No hay citas en la DB de prueba");
    }
    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // 3. Hacer clic en el botón Compartir.
    const btnCompartir = page.getByRole("button", { name: /compartir/i });
    if (
      !(await btnCompartir.isVisible({ timeout: 3_000 }).catch(() => false))
    ) {
      test.skip(true, "El botón Compartir no está visible en esta cita");
    }
    await btnCompartir.click();

    // Esperar a que aparezca el toast "Link copiado".
    await expect(page.getByText(/link copiado/i)).toBeVisible({
      timeout: 3_000,
    });

    // Recuperar la URL copiada del mock.
    const copiedUrl = await page.evaluate(
      () => (window as typeof window & { __copiedUrl?: string }).__copiedUrl,
    );
    expect(copiedUrl).toMatch(/\/cita\/[0-9a-f-]{36}$/);

    // 4. Abrir la URL pública en un contexto NUEVO sin sesión.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(copiedUrl!);
    await publicPage.waitForLoadState("networkidle");

    // La página pública muestra un saludo.
    await expect(publicPage.getByText(/hola/i)).toBeVisible({
      timeout: 5_000,
    });

    // No debe mostrar precios: formatCOP produce "$50.000" — buscar "$" + dígitos.
    const bodyText = await publicPage.locator("body").innerText();
    expect(bodyText).not.toMatch(/\$\s*[\d.]+/);

    await publicContext.close();
  });
});
