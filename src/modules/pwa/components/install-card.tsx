"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { detectPlatform, type Platform } from "@/lib/platform";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Tarjeta "Instala CatApp" con instrucciones según la plataforma (F9.B1). */
export function InstallCard() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    setInstalled(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <p className="text-sm font-medium">Instala CatApp en tu teléfono</p>

      {platform === "ios" ? (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
          En Safari, toca <strong>Compartir</strong> y luego{" "}
          <strong>“Agregar a inicio”</strong> para tenerla como una app.
        </p>
      ) : deferred ? (
        <Button onClick={install} className="w-full">
          <Download className="size-4" />
          Instalar app
        </Button>
      ) : (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <SquarePlus className="mt-0.5 size-4 shrink-0" aria-hidden />
          En Chrome, abre el menú <strong>⋮</strong> y elige{" "}
          <strong>“Instalar app”</strong> / “Agregar a la pantalla principal”.
        </p>
      )}
    </div>
  );
}
