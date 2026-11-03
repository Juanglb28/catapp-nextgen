import { beforeAll, describe, expect, it } from "vitest";

// Test de integración del flujo de registro. Requiere una DB de test con las
// migraciones aplicadas. Se ejecuta solo si TEST_DATABASE_URL está definida
// (en CI/sandbox sin DB se salta). F1.B4 amplía el arnés de tests de integración.
const TEST_DB = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DB)("registro (integración)", () => {
  let auth: typeof import("@/lib/auth").auth;

  // El import en frío de @/lib/auth (better-auth + drizzle + pg, transformados
  // por Vite bajo jsdom) puede pasar de 5 s con la suite completa: va en un
  // hook con su propio timeout para que no cuente contra el test.
  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ auth } = await import("@/lib/auth"));
  }, 30_000);

  // signUpEmail hashea con scrypt en JS puro + primera conexión del pool:
  // margen de 15 s en vez de los 5 s por defecto.
  it("crea un usuario y abre sesión activa", async () => {
    const email = `test-${Date.now()}@correo.com`;
    const res = await auth.api.signUpEmail({
      body: { name: "Test", email, password: "12345678" },
    });

    expect(res.user.email).toBe(email);
    // token de sesión presente => sesión activa tras el registro
    expect(res.token).toBeTruthy();
  }, 15_000);
});
