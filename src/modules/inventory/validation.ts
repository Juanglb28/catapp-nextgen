import { z } from "zod";

/** Unidades soportadas para los productos del inventario. */
export const UNITS = ["unidad", "ml", "gr", "par"] as const;
export type Unit = (typeof UNITS)[number];

const quantity = z
  .number()
  .positive({ message: "La cantidad debe ser mayor a 0" })
  .max(1_000_000);

export const productFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Ponle un nombre" }).max(100),
  unit: z.enum(UNITS),
  minStock: z.number().min(0).max(1_000_000),
  /** Costo unitario en pesos (entero) u opcional. */
  costCop: z.number().int().min(0).nullable(),
  /** Solo al crear: stock inicial (se ignora al editar). */
  initialStock: z.number().min(0).max(1_000_000).optional(),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

/** Entrada/salida rápida desde la tarjeta. */
export const movementFormSchema = z.object({
  type: z.enum(["in", "out"]),
  quantity,
  reason: z.string().trim().max(200).optional(),
});

export type MovementFormInput = z.infer<typeof movementFormSchema>;

/** Ajuste de stock: valor REAL contado + motivo obligatorio. */
export const adjustFormSchema = z.object({
  realStock: z.number().min(0).max(1_000_000),
  reason: z
    .string()
    .trim()
    .min(1, { message: "Indica el motivo del ajuste" })
    .max(200),
});

export type AdjustFormInput = z.infer<typeof adjustFormSchema>;
