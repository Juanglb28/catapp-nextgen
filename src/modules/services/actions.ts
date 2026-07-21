"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { withTenantAction } from "@/modules/tenancy/action";

import {
  activateService,
  createService,
  deactivateService,
  type ServiceInput,
  updateService,
} from "./repository";
import { serviceFormSchema } from "./validation";

const SERVICES_PATH = "/ajustes/servicios";

function parse(input: unknown) {
  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

/** Convierte el formulario validado a la forma que persiste el repositorio. */
function toServiceInput(data: {
  name: string;
  basePriceCop: number;
  durationMin: number;
}): ServiceInput {
  return {
    name: data.name,
    basePriceCop: BigInt(data.basePriceCop),
    durationMin: data.durationMin,
  };
}

export async function createServiceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return withTenantAction(async ({ tenantId }) => {
    const parsed = parse(input);
    if (!parsed.ok) return fail(parsed.error);

    const service = await createService(tenantId, toServiceInput(parsed.data));
    revalidatePath(SERVICES_PATH);
    return ok({ id: service.id });
  });
}

export async function updateServiceAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return withTenantAction(async ({ tenantId }) => {
    const parsed = parse(input);
    if (!parsed.ok) return fail(parsed.error);

    const service = await updateService(
      tenantId,
      id,
      toServiceInput(parsed.data),
    );
    if (!service) return fail("No se encontró el servicio.");

    revalidatePath(SERVICES_PATH);
    return ok({ id: service.id });
  });
}

export async function deactivateServiceAction(
  id: string,
): Promise<ActionResult> {
  return withTenantAction(async ({ tenantId }) => {
    const service = await deactivateService(tenantId, id);
    if (!service) return fail("No se encontró el servicio.");

    revalidatePath(SERVICES_PATH);
    return ok();
  });
}

export async function activateServiceAction(id: string): Promise<ActionResult> {
  return withTenantAction(async ({ tenantId }) => {
    const service = await activateService(tenantId, id);
    if (!service) return fail("No se encontró el servicio.");

    revalidatePath(SERVICES_PATH);
    return ok();
  });
}
