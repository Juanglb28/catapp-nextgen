import { describe, expect, it } from "vitest";

import { buildWaLink, DEFAULT_TEMPLATES, renderTemplate } from "./templates";

describe("renderTemplate", () => {
  it("sustituye los placeholders por sus valores", () => {
    const out = renderTemplate(
      "Hola {clienta}, tu cita en {negocio} el {fecha}.",
      { clienta: "Ana", negocio: "Uñas de Susana", fecha: "10 de junio" },
    );
    expect(out).toBe("Hola Ana, tu cita en Uñas de Susana el 10 de junio.");
  });

  it("elimina los placeholders sin valor", () => {
    expect(
      renderTemplate("Hola {clienta} {fecha_anterior}", { clienta: "Ana" }),
    ).toBe("Hola Ana ");
  });

  it("renderiza la confirmación por defecto con todos los datos", () => {
    const out = renderTemplate(DEFAULT_TEMPLATES.confirmation, {
      clienta: "María",
      negocio: "Bella Nails",
      fecha: "miércoles 10 de junio",
      hora: "3:00 p. m.",
      servicios: "Manicure semipermanente",
      link: "https://catapp.app/cita/abc",
    });
    expect(out).toContain("¡Hola María!");
    expect(out).toContain("Bella Nails");
    expect(out).toContain("miércoles 10 de junio");
    expect(out).toContain("https://catapp.app/cita/abc");
    // No deben quedar placeholders sin sustituir.
    expect(out).not.toMatch(/\{[a-z_]+\}/);
  });

  it("renderiza el recordatorio de pago con el saldo pendiente", () => {
    const out = renderTemplate(DEFAULT_TEMPLATES.payment_reminder, {
      clienta: "María",
      negocio: "Bella Nails",
      saldo: "$30.000",
    });
    expect(out).toContain("¡Hola María!");
    expect(out).toContain("Bella Nails");
    expect(out).toContain("saldo pendiente de $30.000");
    // No deben quedar placeholders sin sustituir.
    expect(out).not.toMatch(/\{[a-z_]+\}/);
  });
});

describe("buildWaLink", () => {
  it("reduce el teléfono a dígitos y codifica el texto", () => {
    const link = buildWaLink("+57 300 123 4567", "Hola");
    expect(link).toBe("https://wa.me/573001234567?text=Hola");
  });

  it("codifica tildes, emojis y saltos de línea", () => {
    const link = buildWaLink("573001234567", "¡Hola! 😊\nTu cita");
    expect(link.startsWith("https://wa.me/573001234567?text=")).toBe(true);
    // El texto no debe contener caracteres crudos problemáticos.
    expect(link).not.toContain("\n");
    expect(link).not.toContain(" ");
    expect(link).toContain("%0A"); // salto de línea codificado
    // Decodificar recupera el original.
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toBe("¡Hola! 😊\nTu cita");
  });
});
