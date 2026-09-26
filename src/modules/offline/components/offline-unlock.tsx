"use client";

import { Fingerprint, WifiOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

import { checkPassword, type PasswordVerifier } from "../password-verifier";
import { canUseLocalBiometric, verifyLocalBiometric } from "../webauthn-local";

const FAILS_KEY = "catapp-offline-fails";
const MAX_FAILS = 5;
const COOLDOWN_MS = 60_000;

type Fails = { count: number; until: number };

function readFails(): Fails {
  try {
    const raw = sessionStorage.getItem(FAILS_KEY);
    return raw ? (JSON.parse(raw) as Fails) : { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

function writeFails(f: Fails): void {
  try {
    sessionStorage.setItem(FAILS_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

/** Pantalla de desbloqueo local sin conexión (D-35): huella o contraseña. */
export function OfflineUnlock({
  rpId,
  credentialIds,
  verifier,
  onUnlocked,
}: {
  rpId: string | null;
  credentialIds: string[];
  verifier: PasswordVerifier | null;
  onUnlocked: () => void;
}) {
  const canBio = !!rpId && canUseLocalBiometric(credentialIds);
  const canPwd = !!verifier && verifier.hash !== "";
  const [usePassword, setUsePassword] = useState(!canBio);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlockWithBiometric() {
    if (!rpId) return;
    setLoading(true);
    setError(null);
    try {
      if (await verifyLocalBiometric(rpId, credentialIds)) {
        onUnlocked();
        return;
      }
      throw new Error("not-verified");
    } catch {
      setError(
        canPwd
          ? "No se pudo verificar la huella. Usa tu contraseña."
          : "No se pudo verificar la huella.",
      );
      if (canPwd) setUsePassword(true);
    } finally {
      setLoading(false);
    }
  }

  async function unlockWithPassword() {
    if (!verifier) return;
    const fails = readFails();
    if (fails.until > Date.now()) {
      setError("Demasiados intentos. Espera un minuto.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (await checkPassword(password, verifier)) {
        writeFails({ count: 0, until: 0 });
        onUnlocked();
        return;
      }
      const count = fails.count + 1;
      writeFails(
        count >= MAX_FAILS
          ? { count: 0, until: Date.now() + COOLDOWN_MS }
          : { count, until: 0 },
      );
      setError("Contraseña incorrecta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <WifiOff className="text-muted-foreground size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sin conexión</h1>
        <p className="text-muted-foreground text-sm">
          Confirma que eres tú para consultar tus citas y clientas guardadas.
        </p>
      </div>

      {!canBio && !canPwd ? (
        <p className="text-muted-foreground text-sm">
          Este teléfono aún no tiene cómo verificarte sin internet. Con
          conexión, inicia sesión con tu contraseña o activa la huella en
          Ajustes → Seguridad.
        </p>
      ) : !usePassword ? (
        <div className="w-full space-y-3">
          <Button
            className="w-full"
            onClick={unlockWithBiometric}
            disabled={loading}
          >
            <Fingerprint className="size-4" aria-hidden />
            {loading ? "Verificando…" : "Desbloquear con huella"}
          </Button>
          {canPwd && (
            <button
              type="button"
              onClick={() => setUsePassword(true)}
              className="text-muted-foreground hover:text-foreground w-full text-sm underline"
            >
              Usar mi contraseña
            </button>
          )}
        </div>
      ) : (
        <form
          className="w-full space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            void unlockWithPassword();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="offline-pwd">Contraseña de tu cuenta</Label>
            <PasswordInput
              id="offline-pwd"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Verificando…" : "Desbloquear"}
          </Button>
          {canBio && (
            <button
              type="button"
              onClick={() => setUsePassword(false)}
              className="text-muted-foreground hover:text-foreground w-full text-sm underline"
            >
              Volver a la huella
            </button>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
