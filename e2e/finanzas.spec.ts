import { expect, test } from "@playwright/test";

/**
 * E2E del dashboard de finanzas (F6.B2).
 * Flujo: ver dashboard → navegar mes anterior → descargar CSV.
 * Requiere sesión de prueba (e2e/.auth/session.json).
 */
test.describe("finanzas", () => {
  test("muestra el dashboard del mes actual", async ({ page }) => {
    await page.goto("/finanzas");
    await page.waitForLoadState("networkidle");

    // La página carga sin error — el encabezado de sección es visible.
    await expect(page.getByRole("heading", { name: /finanzas/i })).toBeVisible({
      timeout: 5_000,
    });

    // La tarjeta protagonista "Total del mes" está visible.
    await expect(page.getByText(/total del mes/i)).toBeVisible();
  });

  test("navega al mes anterior con la flecha ←", async ({ page }) => {
    await page.goto("/finanzas");
    await page.waitForLoadState("networkidle");

    // El selector de mes tiene un link "mes anterior" (←).
    const btnAnterior = page.getByRole("link", { name: /anterior|←/i }).first();
    await expect(btnAnterior).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/finanzas\?year=\d{4}&month=\d{1,2}/),
      btnAnterior.click(),
    ]);

    // Sigue mostrando el dashboard sin error.
    await expect(page.getByText(/total del mes/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("el link de export CSV responde con Content-Type text/csv", async ({
    page,
    request,
  }) => {
    // Obtener el mes actual.
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Hacer la petición con el contexto autenticado de la página.
    await page.goto("/finanzas");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const baseURL = page.url().replace(/\/finanzas.*$/, "");
    const resp = await request.get(
      `${baseURL}/api/finanzas/export?year=${year}&month=${month}`,
      { headers: { Cookie: cookieHeader } },
    );

    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("text/csv");
  });
});
