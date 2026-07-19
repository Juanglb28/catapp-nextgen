import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeDb,
  resetDb,
  seedTenantWithOwner,
  seedUser,
  TEST_DB,
} from "@/test/db-harness";

/**
 * Conexión de Google Calendar por tenant (F5.B1): el refresh_token se guarda
 * CIFRADO, se lee descifrado, los ajustes persisten y hay aislamiento A/B.
 * Requiere `TEST_DATABASE_URL`.
 */
process.env.GOOGLE_TOKEN_KEY ??= "clave-de-prueba-para-integracion-1234567890";

describe.runIf(TEST_DB)("conexión de Google Calendar (integración)", () => {
  let tenantA: string;
  let tenantB: string;

  beforeEach(async () => {
    await resetDb();
    const a = await seedUser();
    const b = await seedUser();
    tenantA = await seedTenantWithOwner(a.id, "Negocio A");
    tenantB = await seedTenantWithOwner(b.id, "Negocio B");
  });

  afterAll(async () => {
    await closeDb();
  });

  it("guarda el refresh_token cifrado y lo devuelve descifrado", async () => {
    const repo = await import("./repository");
    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "ana@gmail.com",
      refreshToken: "1//refresh-secreto",
    });

    const account = await repo.getGoogleAccount(tenantA);
    expect(account?.googleEmail).toBe("ana@gmail.com");
    expect(account?.status).toBe("connected");
    expect(account?.calendarId).toBe("primary");
    expect(account?.syncEnabled).toBe(true);
    // En DB nunca está el token en claro.
    expect(account?.refreshTokenEnc).not.toContain("1//refresh-secreto");

    const token = await repo.getRefreshToken(tenantA);
    expect(token).toBe("1//refresh-secreto");
  });

  it("aísla la conexión entre tenants (A no ve B)", async () => {
    const repo = await import("./repository");
    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "a@gmail.com",
      refreshToken: "token-A",
    });

    expect(await repo.getGoogleAccount(tenantB)).toBeNull();
    expect(await repo.getRefreshToken(tenantB)).toBeNull();
    expect(await repo.getRefreshToken(tenantA)).toBe("token-A");
  });

  it("actualiza calendario y toggle de sync", async () => {
    const repo = await import("./repository");
    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "a@gmail.com",
      refreshToken: "token-A",
    });

    await repo.updateCalendarSettings(tenantA, {
      calendarId: "work@group.calendar.google.com",
      syncEnabled: false,
    });

    const account = await repo.getGoogleAccount(tenantA);
    expect(account?.calendarId).toBe("work@group.calendar.google.com");
    expect(account?.syncEnabled).toBe(false);
  });

  it("re-conectar conserva ajustes y vuelve a 'connected'", async () => {
    const repo = await import("./repository");
    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "a@gmail.com",
      refreshToken: "token-A",
    });
    await repo.updateCalendarSettings(tenantA, {
      calendarId: "work@cal",
      syncEnabled: false,
    });
    await repo.markBroken(tenantA);

    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "a-nuevo@gmail.com",
      refreshToken: "token-A2",
    });

    const account = await repo.getGoogleAccount(tenantA);
    expect(account?.googleEmail).toBe("a-nuevo@gmail.com");
    expect(account?.status).toBe("connected");
    expect(account?.calendarId).toBe("work@cal");
    expect(account?.syncEnabled).toBe(false);
    expect(await repo.getRefreshToken(tenantA)).toBe("token-A2");
  });

  it("markBroken marca roto y delete elimina la fila", async () => {
    const repo = await import("./repository");
    await repo.saveGoogleAccount(tenantA, {
      googleEmail: "a@gmail.com",
      refreshToken: "token-A",
    });

    await repo.markBroken(tenantA);
    expect((await repo.getGoogleAccount(tenantA))?.status).toBe("broken");

    await repo.deleteGoogleAccount(tenantA);
    expect(await repo.getGoogleAccount(tenantA)).toBeNull();
  });
});
