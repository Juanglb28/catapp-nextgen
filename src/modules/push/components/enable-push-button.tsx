"use client";

import { BellRing } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { subscribeThisDevice } from "../subscribe-client";

const REASON_MESSAGE: Record<string, string> = {
  no_key:
    "Falta la clave pública VAPID en el build. Agrégala en Railway y vuelve a desplegar.",
  unsupported:
    "Este navegador no soporta notificaciones. Usa Chrome en Android con la app instalada.",
  denied:
    "Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o del teléfono para esta app.",
  failed:
    "No se pudo registrar el dispositivo. Verifica tu conexión e inténtalo de nuevo.",
};

/** Registra este dispositivo para recibir notificaciones, con diagnóstico visible. */
export function EnablePushButton() {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await subscribeThisDevice();
      if (result.ok) {
        toast.success(
          "Notificaciones activadas en este dispositivo. Prueba con el botón de al lado.",
        );
      } else {
        toast.error(REASON_MESSAGE[result.reason] ?? "No se pudo activar.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading}>
      <BellRing className="size-4" aria-hidden />
      {loading ? "Activando…" : "Activar en este dispositivo"}
    </Button>
  );
}
