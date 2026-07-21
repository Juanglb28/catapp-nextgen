"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireTenant } from "@/modules/tenancy/context";

import { upsertTemplate } from "./repository";
import { saveTemplateSchema } from "./validation";

export async function saveMessageTemplateAction(
  input: unknown,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  await upsertTemplate(tenantId, parsed.data.key, parsed.data.text);
  revalidatePath("/ajustes/mensajes");
  return { ok: true };
}
