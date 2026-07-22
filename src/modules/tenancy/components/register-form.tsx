"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  registerSchema,
  type RegisterInput,
} from "@/modules/tenancy/auth-validation";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    // `onTouched`: valida al salir del campo y luego en cada cambio, así el aviso
    // de "no coinciden" aparece en cuanto la usuaria termina de escribir.
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      confirmEmail: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(
        error.code === "USER_ALREADY_EXISTS"
          ? "Ya existe una cuenta con ese correo. Inicia sesión."
          : "No se pudo crear la cuenta. Inténtalo de nuevo.",
      );
      return;
    }
    // Con email verification activo, el registro NO crea sesión: la usuaria debe
    // confirmar su correo primero. Si sí hay sesión (dev sin Resend), entramos.
    const { data: session } = await authClient.getSession();
    if (session?.user) {
      router.push("/citas");
      router.refresh();
      return;
    }
    setPendingEmail(values.email);
  }

  if (pendingEmail) {
    return (
      <div className="space-y-3 text-center" role="status">
        <div className="bg-brand/10 text-brand mx-auto flex size-14 items-center justify-center rounded-2xl text-2xl">
          ✉️
        </div>
        <h2 className="text-lg font-semibold">Confirma tu correo</h2>
        <p className="text-muted-foreground text-sm">
          Te enviamos un enlace a <strong>{pendingEmail}</strong>. Ábrelo para
          activar tu cuenta y poder iniciar sesión.
        </p>
        <p className="text-muted-foreground text-xs">
          ¿No llegó? Revisa spam o vuelve a intentarlo en unos minutos.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="Tu nombre"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo electrónico</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirma tu correo</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  onPaste={(e) => e.preventDefault()}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirma tu contraseña</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  onPaste={(e) => e.preventDefault()}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </Form>
  );
}
