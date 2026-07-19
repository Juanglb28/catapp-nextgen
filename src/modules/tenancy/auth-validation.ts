import { z } from "zod";

export const emailField = z.email({
  message: "Ingresa un correo electrónico válido",
});

export const passwordField = z
  .string()
  .min(8, { message: "La contraseña debe tener al menos 8 caracteres" });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, { message: "Ingresa tu contraseña" }),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, { message: "Ingresa tu nombre" }),
  email: emailField,
  password: passwordField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
