import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";

import { isLowStock, movementDelta } from "./domain";
import {
  type Product,
  type StockMovement,
  type StockMovementType,
  products,
  stockMovements,
} from "./schema";

/**
 * Repositorio de inventario (F7.B1) — alcance de tenant obligatorio (D-11).
 * El stock SOLO cambia vía `registerMovement` dentro de una transacción con
 * guarda `stock + delta >= 0` (D-9): la suma de movimientos == stock, siempre.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProductRow = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  costCop: bigint | null;
  active: boolean;
  lowStock: boolean;
};

function toRow(p: Product): ProductRow {
  const stock = Number(p.stock);
  const minStock = Number(p.minStock);
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    stock,
    minStock,
    costCop: p.costCop,
    active: p.active,
    lowStock: isLowStock(stock, minStock),
  };
}

/** Condición SQL de "stock bajo" (mínimo configurado y stock por debajo). */
const lowStockExpr = sql`(${products.minStock} > 0 and ${products.stock} <= ${products.minStock})`;

/**
 * Aplica un movimiento dentro de una transacción: actualiza el stock con guarda
 * atómica (>= 0) y registra el movimiento. Lanza si el stock quedaría negativo.
 */
async function applyMovement(
  tx: Tx,
  tenantId: string,
  productId: string,
  type: StockMovementType,
  quantity: number,
  reason: string | null,
  createdBy: string | null,
): Promise<Product> {
  const delta = String(movementDelta(type, quantity));
  const updated = await tx
    .update(products)
    .set({ stock: sql`${products.stock} + ${delta}::numeric` })
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.id, productId),
        sql`${products.stock} + ${delta}::numeric >= 0`,
      ),
    )
    .returning();

  if (updated.length === 0) {
    const [exists] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
      .limit(1);
    throw new Error(exists ? "Stock insuficiente." : "Producto no encontrado.");
  }

  await tx.insert(stockMovements).values({
    tenantId,
    productId,
    type,
    quantity: String(quantity),
    reason: reason ?? null,
    createdBy: createdBy ?? null,
  });

  return updated[0];
}

export type RegisterMovementInput = {
  type: StockMovementType;
  /** 'in'/'out': magnitud positiva. 'adjust': delta con signo. */
  quantity: number;
  reason?: string | null;
};

/** Registra un movimiento de stock (única vía para cambiar el stock). */
export async function registerMovement(
  tenantId: string,
  productId: string,
  input: RegisterMovementInput,
  createdBy: string | null = null,
): Promise<ProductRow> {
  if (input.quantity === 0) {
    throw new Error("La cantidad no puede ser cero.");
  }
  if ((input.type === "in" || input.type === "out") && input.quantity <= 0) {
    throw new Error("La cantidad debe ser mayor a cero.");
  }
  const product = await db.transaction((tx) =>
    applyMovement(
      tx,
      tenantId,
      productId,
      input.type,
      input.quantity,
      input.reason ?? null,
      createdBy,
    ),
  );
  return toRow(product);
}

export type CreateProductInput = {
  name: string;
  unit?: string;
  minStock?: number;
  costCop?: bigint | null;
  initialStock?: number;
};

/** Crea un producto; el stock inicial entra como movimiento 'in'. */
export async function createProduct(
  tenantId: string,
  input: CreateProductInput,
  createdBy: string | null = null,
): Promise<ProductRow> {
  const product = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({
        tenantId,
        name: input.name,
        unit: input.unit ?? "unidad",
        minStock: String(input.minStock ?? 0),
        costCop: input.costCop ?? null,
      })
      .returning();

    if (input.initialStock && input.initialStock > 0) {
      return applyMovement(
        tx,
        tenantId,
        p.id,
        "in",
        input.initialStock,
        "Stock inicial",
        createdBy,
      );
    }
    return p;
  });
  return toRow(product);
}

/** Actualiza datos del producto (NUNCA el stock; eso va por movimientos). */
export async function updateProduct(
  tenantId: string,
  id: string,
  data: {
    name?: string;
    unit?: string;
    minStock?: number;
    costCop?: bigint | null;
  },
): Promise<ProductRow | null> {
  const set: Partial<typeof products.$inferInsert> = {};
  if (data.name !== undefined) set.name = data.name;
  if (data.unit !== undefined) set.unit = data.unit;
  if (data.minStock !== undefined) set.minStock = String(data.minStock);
  if (data.costCop !== undefined) set.costCop = data.costCop;
  if (Object.keys(set).length === 0) return getProduct(tenantId, id);
  const [p] = await db
    .update(products)
    .set(set)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
    .returning();
  return p ? toRow(p) : null;
}

export async function deactivateProduct(
  tenantId: string,
  id: string,
): Promise<void> {
  await db
    .update(products)
    .set({ active: false })
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)));
}

export async function getProduct(
  tenantId: string,
  id: string,
): Promise<ProductRow | null> {
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
    .limit(1);
  return p ? toRow(p) : null;
}

/** Productos activos del tenant; opcionalmente solo los de stock bajo. */
export async function listProducts(
  tenantId: string,
  opts: { lowStockOnly?: boolean } = {},
): Promise<ProductRow[]> {
  const conds = [eq(products.tenantId, tenantId), eq(products.active, true)];
  if (opts.lowStockOnly) conds.push(lowStockExpr);
  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(asc(products.name));
  return rows.map(toRow);
}

/** Movimientos de un producto, más recientes primero (paginado). */
export async function listMovements(
  tenantId: string,
  productId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: StockMovement[]; hasMore: boolean }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const rows = await db
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, tenantId),
        eq(stockMovements.productId, productId),
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit + 1)
    .offset(offset);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Cantidad de productos activos en stock bajo (para la alerta de la nav). */
export async function lowStockCount(tenantId: string): Promise<number> {
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.active, true),
        lowStockExpr,
      ),
    );
  return r.c;
}
