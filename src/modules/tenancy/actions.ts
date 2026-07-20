"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizePhoneCO } from "@/lib/phone";
import { swallow } from "@/lib/swallow";
import { auth } from "@/lib/auth";
import { requireTenant } from "@/modules/tenancy/context";
import { onboardingSchema } from "@/modules/tenancy/onboarding-validation";
import {
  createTenantWithOwner,
  getUserTenant,
  setAutoMessages,
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

// Los valores de bono ahora se gestionan como opciones por tenant (D-19, B1.1):
// ver createBonusOptionAction / updateBonusOptionAction en modules/birthdays/actions.

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
    } catch (err) {
      // No bloquea el onboarding: los servicios de ejemplo son opcionales.
      swallow(err, { module: "tenancy", op: "onboarding.seedServices", tenantId });
    }
  }

  return { ok: true };
}
