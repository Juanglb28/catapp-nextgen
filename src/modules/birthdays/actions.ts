"use server";

import { revalidatePath } from "next/cache";

import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";

import {
  approveBirthdayBonus,
  chooseBirthdayOption,
  declineBirthdayBonus,
  getBonusByToken,
} from "./repository";
import { BIRTHDAY_OPTION_LABELS, type BirthdayBonusOption } from "./schema";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

/** Clienta elige su opción de regalo. */
export async function chooseBonusOptionAction(
  token: string,
  option: BirthdayBonusOption,
): Promise<ActionResult> {
  if (!Object.keys(BIRTHDAY_OPTION_LABELS).includes(option)) {
    return { ok: false, error: "Opción inválida." };
  }
  const bonus = await getBonusByToken(token);
  if (!bonus) return { ok: false, error: "Bono no encontrado." };
  if (bonus.status !== "approved") {
    return { ok: false, error: "Este bono no está disponible para elegir." };
  }
  const updated = await chooseBirthdayOption(bonus.id, option);
  if (!updated) return { ok: false, error: "No se pudo guardar la elección." };
  return { ok: true, data: undefined };
}

/**
 * Devuelve el bono por token para la pantalla pública (sin autenticación).
 * También devuelve el nombre del negocio para personalizar el mensaje.
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
      };
    }
  | { ok: false; error: string }
> {
  const bonus = await getBonusByToken(token);
  if (!bonus) return { ok: false, error: "not_found" };

  const tenant = await getTenant(bonus.tenantId);
  return {
    ok: true,
    data: {
      id: bonus.id,
      status: bonus.status,
      clientName: bonus.clientName,
      chosenOption: bonus.chosenOption,
      businessName: tenant?.name ?? "tu manicurista",
    },
  };
}
