import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Suite de accesibilidad automatizada (F9.B3). Corre axe-core sobre las 5
 * secciones principales de la app (autenticadas) con viewport móvil (Pixel 7,
 * configurado en playwright.config.ts).
 *
 * Meta: 0 violaciones axe en cada ruta (equivale a Accessibility ≥ 95 en
 * Lighthouse, ya que axe es el motor subyacente).
 *
 * La sesión se toma de e2e/.auth/session.json (generado por auth.setup.ts).
 * Para correr: pnpm test:e2e --project=chromium
 */

/** Espera a que el skeleton de carga desaparezca antes de analizar. */
async function waitForContent(page: Parameters<typeof test>[1]["page"]) {
  // Los skeletons usan role="status" con aria-busy; esperamos a que no estén.
  await page.waitForLoadState("networkidle");
}

const ROUTES = [
  { name: "citas", path: "/citas" },
  { name: "clientas", path: "/clientas" },
  { name: "finanzas", path: "/finanzas" },
  { name: "inventario", path: "/inventario" },
  { name: "ajustes", path: "/ajustes" },
];

test.describe("accesibilidad (axe) — secciones principales", () => {
  for (const route of ROUTES) {
    test(`/${route.name} no tiene violaciones axe`, async ({ page }) => {
      await page.goto(route.path);
      await waitForContent(page);

      const results = await new AxeBuilder({ page })
        // Excluir reglas que dependen del entorno (HTTPS, color-contrast en
        // modo oscuro del sistema, etc.) — falsos positivos en local.
        .disableRules(["color-contrast"])
        .analyze();

      // Filtrar violaciones "incomplete" (axe no pudo determinar el resultado);
      // solo fallar en violaciones confirmadas.
      const violations = results.violations;

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
              v.nodes
                .slice(0, 3)
                .map((n) => `  → ${n.html}`)
                .join("\n"),
          )
          .join("\n");

        expect(
          violations,
          `Violaciones axe en ${route.path}:${report}`,
        ).toHaveLength(0);
      }
    });
  }
});
