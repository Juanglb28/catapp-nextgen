"use server";

import { revalidatePath } from "next/cache";

import { requireTenant } from "@/modules/tenancy/context";

import {
  activateService,
  createService,
  deactivateService,
  type ServiceInput,
  updateService,
} from "./repository";
import { serviceFormSchema } from "./validation";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
  const { tenantId } = await requireTenant();
  const parsed = parse(input);
  if (!parsed.ok) return parsed;

  const service = await createService(tenantId, toServiceInput(parsed.data));
  revalidatePath(SERVICES_PATH);
  return { ok: true, data: { id: service.id } };
}

export async function updateServiceAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { tenantId } = await requireTenant();
  const parsed = parse(input);
  if (!parsed.ok) return parsed;

  const service = await updateService(
    tenantId,
    id,
    toServiceInput(parsed.data),
  );
  if (!service) return { ok: false, error: "No se encontró el servicio." };

  revalidatePath(SERVICES_PATH);
  return { ok: true, data: { id: service.id } };
}

export async function deactivateServiceAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const { tenantId } = await requireTenant();
  const service = await deactivateService(tenantId, id);
  if (!service) return { ok: false, error: "No se encontró el servicio." };

  revalidatePath(SERVICES_PATH);
  return { ok: true, data: undefined };
}

export async function activateServiceAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const { tenantId } = await requireTenant();
  const service = await activateService(tenantId, id);
  if (!service) return { ok: false, error: "No se encontró el servicio." };

  revalidatePath(SERVICES_PATH);
  return { ok: true, data: undefined };
}
