"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizePhoneCO } from "@/lib/phone";
import { auth } from "@/lib/auth";
import { requireTenant } from "@/modules/tenancy/context";
import { onboardingSchema } from "@/modules/tenancy/onboarding-validation";
import {
  createTenantWithOwner,
  getUserTenant,
  setAutoMessages,
  updateBonusValues,
  updateTenantPublicInfo,
} from "@/modules/tenancy/repository";
import { createServices } from "@/modules/services/repository";
import { SAMPLE_SERVICES } from "@/modules/services/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

const publicInfoSchema = z.object({
  publicAddress: z
    .string()
    .trim()
    .max(300, { message: "La dirección es demasiado larga" }),
  publicNote: z
    .string()
    .trim()
    .max(500, { message: "La nota es demasiado larga" }),
});

/** Actualiza la dirección y nota públicas del negocio (F4.B1). */
export async function updateBusinessPublicInfoAction(
  input: unknown,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = publicInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  await updateTenantPublicInfo(tenantId, {
    publicAddress:
      parsed.data.publicAddress === "" ? null : parsed.data.publicAddress,
    publicNote: parsed.data.publicNote === "" ? null : parsed.data.publicNote,
  });
  revalidatePath("/ajustes");
  return { ok: true };
}

const bonusValuesSchema = z.object({
  bonusManicureCop: z.number().int().min(0),
  bonusVeloterapiaCop: z.number().int().min(0),
});

/** Guarda el valor fijo (COP) de cada opción de bono de cumpleaños. */
export async function updateBonusValuesAction(
  input: unknown,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = bonusValuesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  await updateBonusValues(tenantId, {
    bonusManicureCop: BigInt(parsed.data.bonusManicureCop),
    bonusVeloterapiaCop: BigInt(parsed.data.bonusVeloterapiaCop),
  });
  revalidatePath("/ajustes");
  return { ok: true };
}

/** Activa/desactiva los mensajes automáticos de WhatsApp del negocio (F8.B2). */
export async function setAutoMessagesAction(
  enabled: boolean,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  await setAutoMessages(tenantId, enabled);
  revalidatePath("/ajustes");
  return { ok: true };
}

export async function createTenant(input: unknown): Promise<ActionResult> {
  // 1) Sesión activa
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };
  }

  // 2) Validación con Zod (en el servidor, siempre)
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  // 3) Idempotencia: si ya tiene negocio, no crear otro
  const existing = await getUserTenant(session.user.id);
  if (existing) {
    return { ok: true };
  }

  const phone = normalizePhoneCO(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Ingresa un celular colombiano válido." };
  }

  const { tenantId } = await createTenantWithOwner(session.user.id, {
    name: parsed.data.businessName,
    phone,
    timezone: parsed.data.timezone,
  });

  // Seed opcional de servicios de ejemplo (editables después). Si falla, el
  // negocio igual queda creado: los servicios son opcionales.
  if (parsed.data.createSampleServices) {
    try {
      await createServices(tenantId, SAMPLE_SERVICES);
    } catch {
      // No bloquea el onboarding.
    }
  }

  return { ok: true };
}
