import { z } from "zod";

/**
 * Validación del formulario de servicio. El precio se maneja como entero de
 * pesos (lo entrega MoneyInput); la duración en minutos. Mismo schema en
 * cliente (UX) y servidor (autoridad).
 */
export const serviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Ingresa el nombre del servicio" })
    .max(120, { message: "El nombre es demasiado largo" }),
  basePriceCop: z
    .number({ message: "Ingresa un precio válido" })
    .int({ message: "El precio debe ser un entero de pesos" })
    .min(0, { message: "El precio no puede ser negativo" })
    .max(1_000_000_000, { message: "El precio es demasiado alto" }),
  durationMin: z
    .number({ message: "Ingresa la duración" })
    .int({ message: "La duración debe ser un número entero de minutos" })
    .min(1, { message: "La duración debe ser mayor a 0" })
    .max(1440, { message: "La duración es demasiado larga" }),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;

export const emptyServiceForm: ServiceFormInput = {
  name: "",
  basePriceCop: 0,
  durationMin: 60,
};

/**
 * Servicios típicos ofrecidos como seed opcional en el onboarding. La usuaria
 * puede editarlos o eliminarlos después.
 */
export const SAMPLE_SERVICES: {
  name: string;
  basePriceCop: bigint;
  durationMin: number;
}[] = [
  { name: "Manicure tradicional", basePriceCop: 25000n, durationMin: 45 },
  { name: "Manicure semipermanente", basePriceCop: 45000n, durationMin: 60 },
  { name: "Uñas acrílicas", basePriceCop: 80000n, durationMin: 120 },
  { name: "Pedicure", basePriceCop: 35000n, durationMin: 60 },
];
