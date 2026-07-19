import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/modules/tenancy/repository", () => ({
  getUserTenant: vi.fn(),
  // context.ts usa getTenant para getTenantCached (B0.3).
  getTenant: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getUserTenant } from "@/modules/tenancy/repository";

import { resolveTenant } from "./context";

const getSession = vi.mocked(auth.api.getSession);
const getUserTenantMock = vi.mocked(getUserTenant);

// "DB" simulada: dos usuarios, cada uno en un tenant distinto.
const MEMBERSHIPS: Record<string, { tenantId: string }> = {
  userA: { tenantId: "tenant-A" },
  userB: { tenantId: "tenant-B" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getUserTenantMock.mockImplementation(
    async (uid: string) => MEMBERSHIPS[uid] ?? null,
  );
});

/**
 * Aislamiento a nivel de resolución de contexto (sin DB, corre en CI/sandbox).
 * Verifica que `resolveTenant` mapea cada sesión a SU propio tenant y nunca
 * filtra el de otro usuario.
 */
describe("aislamiento: resolveTenant mapea cada usuario a su propio tenant", () => {
  it("userA resuelve a tenant-A", async () => {
    getSession.mockResolvedValue({ user: { id: "userA" } } as never);
    await expect(resolveTenant()).resolves.toMatchObject({
      userId: "userA",
      tenantId: "tenant-A",
    });
  });

  it("userB resuelve a tenant-B (jamás al de A)", async () => {
    getSession.mockResolvedValue({ user: { id: "userB" } } as never);
    const ctx = await resolveTenant();
    expect(ctx.tenantId).toBe("tenant-B");
    expect(ctx.tenantId).not.toBe("tenant-A");
  });

  it("un usuario sin membresía no hereda ningún tenant (-> /onboarding)", async () => {
    getSession.mockResolvedValue({ user: { id: "fantasma" } } as never);
    await expect(resolveTenant()).rejects.toThrow("REDIRECT:/onboarding");
  });
});
