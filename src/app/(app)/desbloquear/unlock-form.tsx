"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");

  function done() {
    router.replace(next);
    router.refresh();
  }

  async function unlockWithBiometric() {
    setLoading(true);
    try {
      const optionsJSON = await fetch("/api/security/authenticate/options", {
        method: "POST",
      }).then((r) => r.json());
      const assertion = await startAuthentication({ optionsJSON });
      const res = await fetch("/api/security/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!res.ok) throw new Error("verify");
      done();
    } catch {
      toast.error("No se pudo desbloquear con huella. Usa tu contraseña.");
      setUsePassword(true);
    } finally {
      setLoading(false);
    }
  }

  async function unlockWithPassword() {
    setLoading(true);
    try {
      const res = await fetch("/api/security/unlock-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("invalid");
      done();
    } catch {
      toast.error("Contraseña incorrecta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      {!usePassword ? (
        <>
          <Button
            className="w-full"
            onClick={unlockWithBiometric}
            disabled={loading}
          >
            <Fingerprint className="size-4" aria-hidden />
            {loading ? "Verificando…" : "Desbloquear con huella"}
          </Button>
          <button
            type="button"
            onClick={() => setUsePassword(true)}
            className="text-muted-foreground hover:text-foreground w-full text-sm underline"
          >
            Usar mi contraseña
          </button>
        </>
      ) : (
        <form
          className="space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            void unlockWithPassword();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pwd">Contraseña de tu cuenta</Label>
            <Input
              id="pwd"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Verificando…" : "Desbloquear"}
          </Button>
          <button
            type="button"
            onClick={() => setUsePassword(false)}
            className="text-muted-foreground hover:text-foreground w-full text-sm underline"
          >
            Volver a la huella
          </button>
        </form>
      )}
    </div>
  );
}
