import { expect, test } from "@playwright/test";

/**
 * E2E del flujo de creación de cita (F3.B2).
 * Requiere al menos una clienta y un servicio en la DB local.
 * La sesión viene de e2e/.auth/session.json (auth.setup.ts).
 *
 * Selector clave: los botones de clienta y servicio son <button type="button">
 * planos (sin data-slot). Shadcn Button tiene data-slot="button", así que
 * :not([data-slot="button"]) excluye todos los controles de UI y deja solo
 * los botones de datos (clientas/servicios). En el DOM, las clientas aparecen
 * antes que los servicios, lo que permite seleccionar ambos con .first().
 */
test.describe("crear cita", () => {
  test("flujo completo en /citas/nueva", async ({ page }) => {
    await page.goto("/citas/nueva");

    // Botones de datos: clientas y servicios (sin aria-label ni data-slot).
    const dataBtns = page.locator(
      'button[type="button"]:not([data-slot="button"]):not([aria-label])',
    );

    // 1. Seleccionar la primera clienta disponible.
    //    Las clientas aparecen antes que los servicios en el DOM.
    const primeraClientaBtn = dataBtns.first();
    await expect(primeraClientaBtn).toBeVisible({ timeout: 5_000 });
    await primeraClientaBtn.click();

    // Tras seleccionar, las clientas desaparecen del DOM; quedan los servicios.
    // 2. Seleccionar el primer servicio disponible.
    const primerServicioBtn = dataBtns.first();
    await expect(primerServicioBtn).toBeVisible({ timeout: 5_000 });
    await primerServicioBtn.click();

    // 3. Crear la cita.
    await page.getByRole("button", { name: /crear cita/i }).click();

    // 3b. Si ya hay una cita en el mismo horario (runs anteriores acumulan datos),
    //     el form muestra "Crear de todos modos" en lugar de navegar.
    //     Hacemos clic para forzar la creación igualmente.
    const btnForce = page.getByRole("button", {
      name: /crear de todos modos/i,
    });
    if (await btnForce.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await btnForce.click();
    }

    // 4. Redirige al detalle de la cita recién creada.
    await expect(page).toHaveURL(/\/citas\/[0-9a-f-]{36}$/, {
      timeout: 10_000,
    });
    await expect(page.getByText(/total/i)).toBeVisible();
  });
});
