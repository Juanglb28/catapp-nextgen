"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Comparte el link público de la cita (navigator.share con fallback a copiar). */
export function ShareAppointmentButton({
  publicToken,
}: {
  publicToken: string;
}) {
  async function share() {
    const url = `${window.location.origin}/cita/${publicToken}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Tu cita", url });
        return;
      } catch {
        // El usuario canceló el diálogo de compartir: no hacemos nada.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={share}>
      <Share2 className="size-4" />
      Compartir
    </Button>
  );
}
