import { expect, test } from "@playwright/test";

/**
 * E2E breve de la ficha de clienta (F3.B5): el botón "Nueva cita" lleva a
 * /citas/nueva con la clienta preseleccionada. Requiere sesión de prueba y al
 * menos una clienta; ajústalo a tu estrategia de seed.
 */
test.describe("ficha de clienta", () => {
  test("nueva cita preselecciona la clienta", async ({ page }) => {
    await page.goto("/clientas");
    // Abrir la primera clienta de la lista.
    await page.locator("a[href^='/clientas/']").first().click();

    await page.getByRole("link", { name: /nueva cita/i }).click();
    await expect(page).toHaveURL(/\/citas\/nueva\?cliente=/);
  });
});
