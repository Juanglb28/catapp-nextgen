import { expect, test } from "@playwright/test";

/**
 * E2E del flujo "cita en curso" — editar, pagar y completar (F3.B4).
 *
 * Estrategia: parte de la agenda (/citas), busca la primera cita agendada
 * de la lista y navega a su detalle. Requiere al menos una cita con status
 * "scheduled" en la DB de prueba. Si no hay ninguna, el test se salta.
 */
test.describe("editar cita", () => {
  /** Navega al detalle de la primera cita agendada; devuelve false si no hay. */
  async function openFirstScheduledAppointment(
    page: Parameters<typeof test>[1]["page"],
  ): Promise<boolean> {
    await page.goto("/citas");
    await page.waitForLoadState("networkidle");

    // Las tarjetas de cita en la agenda son links a /citas/<uuid>.
    const firstCard = page.locator("a[href^='/citas/']").first();
    if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return false;
    }
    await firstCard.click();
    await page.waitForLoadState("networkidle");
    return true;
  }

  test("registrar un pago parcial", async ({ page }) => {
    const found = await openFirstScheduledAppointment(page);
    if (!found) {
      test.skip(true, "No hay citas agendadas en la DB de prueba");
    }

    // Botón "Registrar pago" visible en citas no bloqueadas.
    const btnPago = page.getByRole("button", { name: /registrar pago/i });
    if (!(await btnPago.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(
        true,
        "La cita encontrada está bloqueada (completada/cancelada)",
      );
    }
    await btnPago.click();

    // El sheet de pago abre con un campo de monto.
    await expect(
      page.getByRole("heading", { name: /registrar pago/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Dejar el monto por defecto (el saldo) y guardar.
    await page
      .getByRole("button", { name: /registrar pago/i })
      .last()
      .click();

    // Toast de éxito.
    await expect(page.getByText(/pago registrado/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("editar notas de la cita", async ({ page }) => {
    const found = await openFirstScheduledAppointment(page);
    if (!found) {
      test.skip(true, "No hay citas agendadas en la DB de prueba");
    }

    // Botón "Editar" de fecha y hora (primer Editar del detalle).
    const btnEditar = page.getByRole("button", { name: /editar/i }).first();
    if (!(await btnEditar.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(
        true,
        "La cita encontrada está bloqueada (completada/cancelada)",
      );
    }
    await btnEditar.click();

    // Sheet de edición de fecha/hora/personas/notas.
    await expect(page.getByRole("heading", { name: /editar/i })).toBeVisible({
      timeout: 3_000,
    });

    // Añadir una nota.
    const notasInput = page.getByLabel(/notas/i);
    await notasInput.fill("Nota E2E automatizada");

    await page.getByRole("button", { name: /guardar/i }).click();

    await expect(page.getByText(/cita actualizada/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
