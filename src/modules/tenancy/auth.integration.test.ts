import { describe, expect, it } from "vitest";

// Test de integración del flujo de registro. Requiere una DB de test con las
// migraciones aplicadas. Se ejecuta solo si TEST_DATABASE_URL está definida
// (en CI/sandbox sin DB se salta). F1.B4 amplía el arnés de tests de integración.
const TEST_DB = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DB)("registro (integración)", () => {
  it("crea un usuario y abre sesión activa", async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { auth } = await import("@/lib/auth");

    const email = `test-${Date.now()}@correo.com`;
    const res = await auth.api.signUpEmail({
      body: { name: "Test", email, password: "12345678" },
    });

    expect(res.user.email).toBe(email);
    // token de sesión presente => sesión activa tras el registro
    expect(res.token).toBeTruthy();
  });
});
