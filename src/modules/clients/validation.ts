import { z } from "zod";

import { normalizePhone } from "@/lib/phone";

/**
 * Validación del formulario de clienta. Todos los campos son strings (lo que
 * entrega el formulario); el email y las notas admiten cadena vacía = sin dato.
 * El mismo schema se valida en cliente (UX) y en el servidor (autoridad).
 */
export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Ingresa el nombre de la clienta" })
    .max(120, { message: "El nombre es demasiado largo" }),
  phone: z.string().refine((v) => normalizePhone(v) !== null, {
    message:
      "Ingresa un celular colombiano válido (+57 3XX XXX XXXX) o un número internacional (+ indicativo de país)",
  }),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Ingresa un correo electrónico válido",
    }),
  notes: z
    .string()
    .trim()
    .max(2000, { message: "Las notas son demasiado largas" }),
  /**
   * Fecha de cumpleaños en formato "YYYY-MM-DD" (input[type=date]).
   * Cadena vacía = sin dato. Se guarda como `date` en DB.
   */
  birthdayDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Fecha inválida",
    }),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

export const emptyClientForm: ClientFormInput = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  birthdayDate: "",
};
