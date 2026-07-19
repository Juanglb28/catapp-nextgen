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
}));

import { auth } from "@/lib/auth";
import { getUserTenant } from "@/modules/tenancy/repository";

import { resolveTenant } from "./context";

const getSession = vi.mocked(auth.api.getSession);
const getUserTenantMock = vi.mocked(getUserTenant);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveTenant", () => {
  it("sin sesión redirige a /login", async () => {
    getSession.mockResolvedValue(null);
    await expect(resolveTenant()).rejects.toThrow("REDIRECT:/login");
  });

  it("con sesión pero sin tenant redirige a /onboarding", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue(null);
    await expect(resolveTenant()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("con tenant devuelve el contexto", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue({ tenantId: "t1", role: "owner" });
    await expect(resolveTenant()).resolves.toEqual({
      userId: "u1",
      tenantId: "t1",
      role: "owner",
    });
  });
});
