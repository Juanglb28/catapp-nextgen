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

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, { message: "Ingresa tu nombre" }),
    email: emailField,
    confirmEmail: z.string().min(1, { message: "Confirma tu correo" }),
    password: passwordField,
    confirmPassword: z.string().min(1, { message: "Confirma tu contraseña" }),
  })
  // Confirmación de correo y contraseña (evita errores de tipeo al registrarse).
  // El error se ancla al campo de confirmación para mostrar el warning allí.
  .refine((d) => d.email === d.confirmEmail, {
    message: "Los correos no coinciden",
    path: ["confirmEmail"],
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
