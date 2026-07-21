"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireTenant } from "@/modules/tenancy/context";

import { adjustDelta } from "./domain";
import {
  createProduct,
  deactivateProduct,
  getProduct,
  registerMovement,
  updateProduct,
} from "./repository";
import {
  adjustFormSchema,
  movementFormSchema,
  productFormSchema,
} from "./validation";

function firstError(error: import("zod").ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function createProductAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { tenantId, userId } = await requireTenant();
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const product = await createProduct(
    tenantId,
    {
      name: d.name,
      unit: d.unit,
      minStock: d.minStock,
      costCop: d.costCop === null ? null : BigInt(d.costCop),
      initialStock: d.initialStock ?? 0,
    },
    userId,
  );
  revalidatePath("/inventario");
  return { ok: true, id: product.id };
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const updated = await updateProduct(tenantId, id, {
    name: d.name,
    unit: d.unit,
    minStock: d.minStock,
    costCop: d.costCop === null ? null : BigInt(d.costCop),
  });
  if (!updated) return { ok: false, error: "Producto no encontrado." };
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${id}`);
  return { ok: true };
}

export async function deactivateProductAction(
  id: string,
): Promise<ActionResult> {
  const { tenantId } = await requireTenant();
  await deactivateProduct(tenantId, id);
  revalidatePath("/inventario");
  return { ok: true };
}

/** Entrada/salida rápida de stock. */
export async function registerMovementAction(
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = movementFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await registerMovement(
      tenantId,
      productId,
      {
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason ?? null,
      },
      userId,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo registrar.",
    };
  }
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productId}`);
  return { ok: true };
}

/** Ajuste: la usuaria ingresa el valor REAL contado; el sistema calcula el delta. */
export async function adjustStockAction(
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = adjustFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const product = await getProduct(tenantId, productId);
  if (!product) return { ok: false, error: "Producto no encontrado." };

  const delta = adjustDelta(parsed.data.realStock, product.stock);
  if (delta === 0) return { ok: true }; // ya coincide; nada que ajustar.

  try {
    await registerMovement(
      tenantId,
      productId,
      { type: "adjust", quantity: delta, reason: parsed.data.reason },
      userId,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo ajustar.",
    };
  }
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productId}`);
  return { ok: true };
}
