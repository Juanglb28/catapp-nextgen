"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getRecaptchaToken } from "@/lib/recaptcha-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      // reCAPTCHA v3: token verificado en el servidor por Better Auth (si activo).
      const captchaToken = await getRecaptchaToken("reset");
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/nueva-contrasena",
        ...(captchaToken
          ? {
              fetchOptions: { headers: { "x-captcha-response": captchaToken } },
            }
          : {}),
      });
      setStatus(error ? "error" : "sent");
    } catch {
      // Sin esto, un fallo de red (p. ej. el fetch rechazado dentro del
      // service worker) dejaba el botón en "Enviando…" para siempre: nunca se
      // llegaba a `setStatus`, porque el error no estaba contenido.
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-3 rounded-xl border p-4 text-sm">
        <p className="font-medium">Revisa tu correo</p>
        <p className="text-muted-foreground">
          Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace
          para restablecer tu contraseña en los próximos minutos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email-reset">Correo electrónico</Label>
        <Input
          id="email-reset"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          Ocurrió un error. Inténtalo de nuevo.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
