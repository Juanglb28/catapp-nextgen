import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/modules/tenancy/repository", () => ({
  getUserTenant: vi.fn(),
  createTenantWithOwner: vi.fn(),
  // context.ts (importado por las actions) usa getTenant para getTenantCached (B0.3).
  getTenant: vi.fn(),
}));
vi.mock("@/modules/services/repository", () => ({
  createServices: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { createServices } from "@/modules/services/repository";
import {
  createTenantWithOwner,
  getUserTenant,
} from "@/modules/tenancy/repository";

import { createTenant } from "./actions";

const getSession = vi.mocked(auth.api.getSession);
const getUserTenantMock = vi.mocked(getUserTenant);
const createMock = vi.mocked(createTenantWithOwner);
const createServicesMock = vi.mocked(createServices);

const validInput = {
  businessName: "Uñas de Susana",
  phone: "300 123 4567",
  timezone: "America/Bogota",
  createSampleServices: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTenant (server action)", () => {
  it("rechaza sin sesión", async () => {
    getSession.mockResolvedValue(null);
    const r = await createTenant(validInput);
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza teléfono inválido (fijo)", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    const r = await createTenant({ ...validInput, phone: "6012345678" });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("es idempotente si el usuario ya tiene negocio", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue({ tenantId: "t1", role: "owner" });
    const r = await createTenant(validInput);
    expect(r.ok).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crea negocio + owner con el teléfono normalizado a E.164", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ tenantId: "t1" });
    const r = await createTenant(validInput);
    expect(r.ok).toBe(true);
    expect(createMock).toHaveBeenCalledWith("u1", {
      name: "Uñas de Susana",
      phone: "+573001234567",
      timezone: "America/Bogota",
    });
  });

  it("siembra servicios de ejemplo cuando se marca la casilla", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ tenantId: "t1" });
    await createTenant(validInput);
    expect(createServicesMock).toHaveBeenCalledTimes(1);
    expect(createServicesMock).toHaveBeenCalledWith("t1", expect.any(Array));
  });

  it("no siembra servicios si la casilla está desmarcada", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never);
    getUserTenantMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ tenantId: "t1" });
    await createTenant({ ...validInput, createSampleServices: false });
    expect(createServicesMock).not.toHaveBeenCalled();
  });
});
