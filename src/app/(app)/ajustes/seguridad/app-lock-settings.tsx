"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function AppLockSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function enable() {
    setLoading(true);
    try {
      const optionsJSON = await fetch("/api/security/register/options", {
        method: "POST",
      }).then((r) => r.json());
      const attestation = await startRegistration({ optionsJSON });
      const res = await fetch("/api/security/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      if (!res.ok) throw new Error("verify");
      toast.success("Bloqueo activado.");
      router.refresh();
    } catch {
      toast.error(
        "No se pudo activar. Verifica que tu celular tenga huella o desbloqueo configurado.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!password) {
      toast.error("Escribe tu contraseña para desactivar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/security/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("invalid");
      toast.success("Bloqueo desactivado.");
      setPassword("");
      router.refresh();
    } catch {
      toast.error("Contraseña incorrecta.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-5" aria-hidden />
          <p className="font-medium">Bloqueo desactivado</p>
        </div>
        <p className="text-muted-foreground text-sm">
          Al activarlo se pedirá tu huella (o contraseña) cada vez que entres a
          Finanzas o Ajustes tras un rato de inactividad.
        </p>
        <Button onClick={enable} disabled={loading}>
          <Fingerprint className="size-4" aria-hidden />
          {loading ? "Activando…" : "Activar con huella"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
        <p className="font-medium">Bloqueo activado</p>
      </div>
      <p className="text-muted-foreground text-sm">
        Finanzas y Ajustes piden tu huella o contraseña. Para desactivarlo,
        confirma con la contraseña de tu cuenta.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-disable">Contraseña de tu cuenta</Label>
        <PasswordInput
          id="pwd-disable"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button variant="outline" onClick={disable} disabled={loading}>
        {loading ? "Desactivando…" : "Desactivar bloqueo"}
      </Button>
    </div>
  );
}
