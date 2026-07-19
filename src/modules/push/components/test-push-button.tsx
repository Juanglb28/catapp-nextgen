"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { sendTestPushAction } from "../actions";

const REASON_MESSAGE: Record<string, string> = {
  not_configured:
    "El servidor no tiene las claves VAPID configuradas. Agrégalas en Railway y vuelve a desplegar.",
  no_subscriptions:
    "Este dispositivo no está suscrito. Abre la app instalada y acepta las notificaciones.",
  send_failed:
    "Había dispositivos suscritos pero no se pudo entregar (suscripción expirada). Reinstala la app y acepta las notificaciones.",
};

export function TestPushButton() {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await sendTestPushAction();
      if (result.ok) {
        toast.success(
          result.devices === 1
            ? "Enviada a 1 dispositivo. Revisa tus notificaciones."
            : `Enviada a ${result.devices} dispositivos. Revisa tus notificaciones.`,
        );
      } else {
        toast.error(REASON_MESSAGE[result.reason] ?? "No se pudo enviar.");
      }
    } catch {
      toast.error("No se pudo enviar la notificación de prueba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={run} disabled={loading}>
      <Bell className="size-4" aria-hidden />
      {loading ? "Enviando…" : "Probar notificación"}
    </Button>
  );
}
