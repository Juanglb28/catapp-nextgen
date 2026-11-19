import { expect, test } from "@playwright/test";

/**
 * E2E del módulo de inventario (F7.B2).
 * Flujo: crear producto → verificar en lista → registrar entrada → registrar salida.
 * Requiere sesión de prueba (e2e/.auth/session.json).
 */
test.describe("inventario", () => {
  const productName = `E2E-${Date.now()}`;

  test("crear producto y aparece en la lista", async ({ page }) => {
    await page.goto("/inventario");

    // Abrir sheet "Nuevo producto".
    await page.getByRole("button", { name: /nuevo/i }).click();
    await expect(
      page.getByRole("heading", { name: /nuevo producto/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Rellenar nombre.
    await page.getByLabel(/nombre/i).fill(productName);

    // Stock inicial.
    await page.getByLabel(/stock inicial/i).fill("10");

    // Crear.
    const crear = page.getByRole("button", { name: /crear producto/i });
    await expect(crear).toBeVisible();
    await expect(crear).toBeEnabled();
    await crear.click();

    // Toast de éxito.
    await expect(page.getByText(/producto creado/i)).toBeVisible({
      timeout: 5_000,
    });

    // El producto aparece en la lista.
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5_000 });
  });

  test("registrar entrada de stock con botón +", async ({ page }) => {
    await page.goto("/inventario");

    // Esperar a que la lista se cargue.
    await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible();

    // Buscar el producto creado antes.
    await page.getByPlaceholder(/buscar producto/i).fill(productName);
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5_000 });

    // Clic en "Registrar entrada" (botón +).
    await page
      .getByRole("button", { name: /registrar entrada/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /entrada/i })).toBeVisible({
      timeout: 3_000,
    });

    // Cambiar cantidad a 5.
    await page.getByLabel(/cantidad/i).fill("5");
    await page
      .getByRole("button", { name: /registrar entrada/i })
      .last()
      .click();

    await expect(page.getByText(/entrada registrada/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("registrar salida de stock con botón −", async ({ page }) => {
    await page.goto("/inventario");
    await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible();

    await page.getByPlaceholder(/buscar producto/i).fill(productName);
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5_000 });

    // Clic en "Registrar salida" (botón −).
    await page
      .getByRole("button", { name: /registrar salida/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /salida/i })).toBeVisible({
      timeout: 3_000,
    });

    await page.getByLabel(/cantidad/i).fill("2");
    await page
      .getByRole("button", { name: /registrar salida/i })
      .last()
      .click();

    await expect(page.getByText(/salida registrada/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("detalle del producto muestra historial de movimientos", async ({
    page,
  }) => {
    await page.goto("/inventario");
    await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible();

    await page.getByPlaceholder(/buscar producto/i).fill(productName);
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5_000 });

    // Navegar al detalle (link sobre el nombre).
    await page.getByText(productName).click();
    await expect(page).toHaveURL(/\/inventario\/[0-9a-f-]{36}/);

    // El historial de movimientos debe estar visible.
    // La página muestra "Entrada", "Salida" en el historial.
    await expect(page.getByText(/entrada|salida/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
