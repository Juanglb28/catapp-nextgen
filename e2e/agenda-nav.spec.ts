import { expect, test } from "@playwright/test";

/**
 * E2E de la agenda (F3.B3): navegación entre días y vista de semana.
 * La sesión viene de e2e/.auth/session.json (auth.setup.ts).
 */
test.describe("agenda", () => {
  test("navega entre días con las flechas y el botón Hoy", async ({ page }) => {
    await page.goto("/citas");

    // El botón "Día siguiente" es un Button asChild → Link con aria-label.
    // Usamos locator de atributo porque Radix Slot puede no propagar el nombre
    // accesible correctamente al rol "link" en algunos entornos de test.
    const btnSiguiente = page.locator('[aria-label="Día siguiente"]');
    await expect(btnSiguiente).toBeVisible();

    // Verificar que el href apunta a una fecha válida antes de hacer clic.
    const href = await btnSiguiente.getAttribute("href");
    expect(href).toMatch(/\/citas\?date=\d{4}-\d{2}-\d{2}/);

    // Navegar al día siguiente y esperar el cambio de URL.
    await Promise.all([
      page.waitForURL(/\/citas\?date=\d{4}-\d{2}-\d{2}/),
      btnSiguiente.click(),
    ]);

    // "Volver a hoy" solo aparece cuando no estamos en el día actual.
    const volverHoy = page.getByRole("link", { name: /volver a hoy/i });
    await expect(volverHoy).toBeVisible();

    // Volver a hoy.
    await Promise.all([
      page.waitForURL(/\/citas($|\?date=)/),
      volverHoy.click(),
    ]);
  });

  test("cambia a la vista de Semana", async ({ page }) => {
    await page.goto("/citas");
    await page.getByRole("link", { name: "Semana" }).click();
    await expect(page).toHaveURL(/view=semana/);
  });
});
