import { z } from "zod";

/** Estado de pago inicial al crear la cita. */
export const PAYMENT_KINDS = ["pending", "paid", "partial"] as const;

export const createAppointmentFormSchema = z.object({
  clientId: z.string().uuid({ message: "Selecciona una clienta" }),
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1, { message: "Agrega al menos un servicio" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: "Hora inválida" }),
  durationMin: z
    .number()
    .int()
    .min(1, { message: "La duración debe ser mayor a 0" })
    .max(1440),
  // null => usar el total calculado; número => override manual.
  totalOverride: z.number().int().min(0).nullable(),
  peopleCount: z.number().int().min(1).max(10),
  notes: z.string().trim().max(2000),
  payment: z.object({
    kind: z.enum(PAYMENT_KINDS),
    amount: z.number().int().min(0),
  }),
  /** Confirmación del usuario para crear aunque haya solape. */
  force: z.boolean().optional(),
  /** Invitar a la clienta por correo al evento de Google Calendar (F5.B2). */
  inviteClient: z.boolean().optional(),
});

export type CreateAppointmentFormInput = z.infer<
  typeof createAppointmentFormSchema
>;

/** Valores iniciales del formulario (fecha = hoy se inyecta en el cliente). */
export const TIME_STEP_MIN = 15;

/**
 * Edición de una cita existente (F3.B4). Todos los campos son opcionales: cada
 * sheet envía solo lo que cambia. `totalOverride`: número = override manual,
 * `null` = volver al total calculado, ausente = no tocar.
 */
export const editAppointmentSchema = z.object({
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1, { message: "La cita necesita al menos un servicio" })
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" })
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: "Hora inválida" })
    .optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
  peopleCount: z.number().int().min(1).max(10).optional(),
  notes: z.string().trim().max(2000).optional(),
  totalOverride: z.number().int().min(0).nullable().optional(),
  /** Invitar a la clienta por correo al evento de Google Calendar (F5.B2). */
  inviteClient: z.boolean().optional(),
});

export type EditAppointmentInput = z.infer<typeof editAppointmentSchema>;

export const registerPaymentSchema = z.object({
  // Permite 0: citas cubiertas por bono de cumpleaños se registran/saldan sin abono.
  amount: z.number().int().min(0, { message: "Ingresa un monto válido" }),
  tip: z.number().int().min(0).optional().default(0),
  paymentMethod: z.enum(["efectivo", "transferencia"]).nullable().optional(),
});

/**
 * Ajuste/corrección del pago: fija el monto pagado a un valor EXACTO (puede ser
 * 0 para revertir). No suma como `registerPayment`.
 */
export const adjustPaymentSchema = z.object({
  amount: z.number().int().min(0, { message: "Ingresa un monto válido" }),
  tip: z.number().int().min(0).optional().default(0),
  paymentMethod: z.enum(["efectivo", "transferencia"]).nullable().optional(),
});

/** Actualiza solo el método de pago, sin montos. */
export const updatePaymentMethodSchema = z.object({
  paymentMethod: z.enum(["efectivo", "transferencia"]).nullable(),
});

export const EDITABLE_STATUSES = ["completed", "no_show", "cancelled"] as const;
export const setStatusSchema = z.object({
  status: z.enum(EDITABLE_STATUSES),
});
