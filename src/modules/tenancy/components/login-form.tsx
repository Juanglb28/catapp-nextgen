"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import Link from "next/link";

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
  loginSchema,
  type LoginInput,
} from "@/modules/tenancy/auth-validation";

export function LoginForm({ resetOk = false }: { resetOk?: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    setUnverifiedEmail(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      // Solo el código EMAIL_NOT_VERIFIED cuenta como "correo sin confirmar".
      // Antes se trataba CUALQUIER 403 así, lo que confundía otros 403 (p. ej.
      // "Invalid origin") con falta de verificación y ofrecía reenviar en vano.
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email);
        return;
      }
      setServerError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/citas");
    router.refresh();
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    await authClient.sendVerificationEmail({ email: unverifiedEmail });
    setResent(true);
  }

  return (
    <Form {...form}>
      {resetOk && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </p>
      )}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Contraseña</FormLabel>
                <Link
                  href="/recuperar-contrasena"
                  className="text-muted-foreground text-xs hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {unverifiedEmail ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            <p>
              Debes confirmar tu correo antes de entrar. Revisa la bandeja de{" "}
              <strong>{unverifiedEmail}</strong>.
            </p>
            {resent ? (
              <p className="mt-1 text-amber-700">Te reenviamos el enlace.</p>
            ) : (
              <button
                type="button"
                onClick={resendVerification}
                className="mt-1 font-medium underline"
              >
                Reenviar correo de confirmación
              </button>
            )}
          </div>
        ) : null}
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
          {form.formState.isSubmitting ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </Form>
  );
}
