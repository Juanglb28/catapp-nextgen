import { z } from "zod";

import { TEMPLATE_KEYS } from "./templates";

export const saveTemplateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  text: z
    .string()
    .trim()
    .min(1, { message: "El mensaje no puede estar vacío" })
    .max(1000, { message: "El mensaje es demasiado largo" }),
});

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;
