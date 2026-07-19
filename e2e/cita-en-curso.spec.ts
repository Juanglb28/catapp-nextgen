import { expect, test } from "@playwright/test";

/**
 * E2E del flujo "cita en curso" (F3.B4): desde la agenda, abrir el detalle
 * de la primera cita agendada y verificar el ciclo registro de pago → estado.
 *
 * Los sub-tests de completar/cancelar están marcados como condicionales porque
 * cambian el estado de la cita y no se pueden revertir sin un seed fresco.
 * En CI se puede añadir un job de seed que cree citas nuevas antes de cada run.
 */
test.describe("cita en curso", () => {
  /** Navega al detalle de la primera cita que tenga botón "Registrar pago". */
  async function openScheduledAppointment(
    page: Parameters<typeof test>[1]["page"],
  ): Promise<boolean> {
    await page.goto("/citas");
    await page.waitForLoadState("networkidle");
    // Excluir /citas/nueva (FAB de crear cita) — solo queremos tarjetas de detalle.
    const firstCard = page
      .locator("a[href^='/citas/']:not([href='/citas/nueva'])")
      .first();
    if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return false;
    }
    await firstCard.click();
    await page.waitForLoadState("networkidle");
    return page
      .getByRole("button", { name: /registrar pago/i })
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
  }

  test("detalle muestra los datos principales de la cita", async ({ page }) => {
    await page.goto("/citas");
    await page.waitForLoadState("networkidle");

    // Excluir /citas/nueva (FAB de crear cita) — solo queremos tarjetas de detalle.
    const firstCard = page
      .locator("a[href^='/citas/']:not([href='/citas/nueva'])")
      .first();
    if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "No hay citas en la DB de prueba");
    }
    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // El detalle de la cita tiene secciones con h2; el rol es "heading".
    // "Fecha y hora" aparece siempre (no depende del estado de la cita).
    await expect(
      page.getByRole("heading", { name: /fecha y hora/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("heading", { name: /servicios/i }),
    ).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test("registrar pago parcial muestra toast de éxito", async ({ page }) => {
    const found = await openScheduledAppointment(page);
    if (!found) {
      test.skip(
        true,
        "No hay citas agendadas con pago pendiente en la DB de prueba",
      );
    }

    await page.getByRole("button", { name: /registrar pago/i }).click();

    await expect(
      page.getByRole("heading", { name: /registrar pago/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Registrar el pago por defecto (saldo completo).
    await page
      .getByRole("button", { name: /registrar pago/i })
      .last()
      .click();

    await expect(page.getByText(/pago registrado/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("completar una cita cambia su estado a completada", async ({ page }) => {
    const found = await openScheduledAppointment(page);
    if (!found) {
      test.skip(true, "No hay citas agendadas en la DB de prueba");
    }

    const btnCompletar = page.getByRole("button", { name: /^completar$/i });
    if (
      !(await btnCompletar.isVisible({ timeout: 2_000 }).catch(() => false))
    ) {
      test.skip(
        true,
        "La cita no tiene botón Completar (puede ser que ya esté cerrada)",
      );
    }

    await btnCompletar.click();

    // Confirmar si aparece un diálogo de confirmación.
    const btnConfirmar = page
      .getByRole("button", { name: /confirmar|completar/i })
      .last();
    if (await btnConfirmar.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await btnConfirmar.click();
    }

    await expect(page.getByText(/completada/i)).toBeVisible({ timeout: 5_000 });
  });
});
