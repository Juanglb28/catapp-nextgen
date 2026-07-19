import { z } from "zod";

import { normalizePhoneCO } from "@/lib/phone";

export const TENANT_TIMEZONES = [
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
] as const;

export const onboardingSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, { message: "Ingresa el nombre de tu negocio" }),
  phone: z.string().refine((v) => normalizePhoneCO(v) !== null, {
    message: "Ingresa un celular colombiano válido (+57 3XX XXX XXXX)",
  }),
  timezone: z.enum(TENANT_TIMEZONES),
  // Sembrar servicios típicos de ejemplo al crear el negocio (F2.B2).
  createSampleServices: z.boolean(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
