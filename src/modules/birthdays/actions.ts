"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";

import {
  approveBirthdayBonus,
  chooseBirthdayOption,
  createBonusOption,
  declineBirthdayBonus,
  getBonusByToken,
  listBonusOptions,
  updateBonusOption,
} from "./repository";

/** Manicurista aprueba el bono → status 'approved'. */
export async function approveBonusAction(
  bonusId: string,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const bonus = await approveBirthdayBonus(tenantId, bonusId);
  if (!bonus) return { ok: false, error: "Bono no encontrado o ya procesado." };
  revalidatePath("/cumpleanos");
  return { ok: true, data: undefined };
}

/** Manicurista rechaza el bono. */
export async function declineBonusAction(
  bonusId: string,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const bonus = await declineBirthdayBonus(tenantId, bonusId);
  if (!bonus) return { ok: false, error: "Bono no encontrado." };
  revalidatePath("/cumpleanos");
  return { ok: true, data: undefined };
}

/**
 * Clienta elige su opción de regalo (D-19, B1.1). Valida el token y que la opción
 * pertenezca al tenant del bono y esté activa. Zod en el borde público (B2.3).
 */
const chooseSchema = z.object({
  token: z.string().uuid(),
  optionId: z.string().uuid(),
});

export async function chooseBonusOptionAction(
  token: string,
  optionId: string,
): Promise<ActionResult> {
  const parsed = chooseSchema.safeParse({ token, optionId });
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };

  const bonus = await getBonusByToken(parsed.data.token);
  if (!bonus) return { ok: false, error: "Bono no encontrado." };
  if (bonus.status !== "approved") {
    return { ok: false, error: "Este bono no está disponible para elegir." };
  }

  // La opción debe pertenecer al MISMO tenant del bono y estar activa.
  const options = await listBonusOptions(bonus.tenantId, { activeOnly: true });
  const option = options.find((o) => o.id === parsed.data.optionId);
  if (!option) return { ok: false, error: "Opción inválida." };

  const updated = await chooseBirthdayOption(bonus.id, {
    id: option.id,
    label: option.label,
  });
  if (!updated) return { ok: false, error: "No se pudo guardar la elección." };
  return { ok: true, data: undefined };
}

/**
 * Datos del bono por token para la pantalla pública (sin autenticación).
 * Incluye las opciones activas del tenant para que la clienta elija.
 */
export async function getPublicBonusAction(token: string): Promise<
  | {
      ok: true;
      data: {
        id: string;
        status: string;
        clientName: string;
        chosenOption: string | null;
        businessName: string;
        options: { id: string; label: string }[];
      };
    }
  | { ok: false; error: string }
> {
  if (!z.string().uuid().safeParse(token).success) {
    return { ok: false, error: "not_found" };
  }
  const bonus = await getBonusByToken(token);
  if (!bonus) return { ok: false, error: "not_found" };

  const [tenant, options] = await Promise.all([
    getTenant(bonus.tenantId),
    listBonusOptions(bonus.tenantId, { activeOnly: true }),
  ]);
  return {
    ok: true,
    data: {
      id: bonus.id,
      status: bonus.status,
      clientName: bonus.clientName,
      chosenOption: bonus.chosenOption,
      businessName: tenant?.name ?? "tu manicurista",
      options: options.map((o) => ({ id: o.id, label: o.label })),
    },
  };
}

// ─── Ajustes: gestión de opciones de bono (owner) ────────────────────────────

const optionSchema = z.object({
  label: z.string().trim().min(1, "Escribe un nombre.").max(80),
  discountCop: z.number().int().min(0),
});

export async function createBonusOptionAction(input: {
  label: string;
  discountCop: number;
}): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = optionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  await createBonusOption(tenantId, {
    label: parsed.data.label,
    discountCop: BigInt(parsed.data.discountCop),
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function updateBonusOptionAction(input: {
  id: string;
  label?: string;
  discountCop?: number;
  active?: boolean;
}): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = z
    .object({
      id: z.string().uuid(),
      label: z.string().trim().min(1).max(80).optional(),
      discountCop: z.number().int().min(0).optional(),
      active: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const updated = await updateBonusOption(tenantId, parsed.data.id, {
    label: parsed.data.label,
    discountCop:
      parsed.data.discountCop !== undefined
        ? BigInt(parsed.data.discountCop)
        : undefined,
    active: parsed.data.active,
  });
  if (!updated) return { ok: false, error: "Opción no encontrada." };
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}
