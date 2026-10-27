"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        setErrorMsg("El enlace es inválido o ya expiró. Solicita uno nuevo.");
        setStatus("error");
        return;
      }
      router.push("/login?reset=ok");
    } catch {
      // Igual que en forgot-password-form: sin este catch, un fallo de red
      // (fetch rechazado, p. ej. por el service worker) dejaba el botón en
      // "Guardando…" para siempre en vez de mostrar un error.
      setErrorMsg("Ocurrió un error de conexión. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {errorMsg}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
