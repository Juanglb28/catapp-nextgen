"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import {
  approveBonusAction,
  declineBonusAction,
} from "@/modules/birthdays/actions";

type BonusCardProps = {
  bonus: {
    id: string;
    status: string;
    clientName: string;
    clientPhone: string;
    chosenLabel: string | null;
    publicToken: string;
  };
  waHref: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_manicurist: "Pendiente tu aprobación",
  approved: "Esperando elección de clienta",
  chosen: "Servicio elegido ✓",
};

export function BonusCard({ bonus, waHref }: BonusCardProps) {
  const [loading, setLoading] = useState<
    "approve" | "decline" | "waive" | "delete" | null
  >(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function handleApprove() {
    setLoading("approve");
    const res = await approveBonusAction(bonus.id);
    setLoading(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Bono aprobado. Ahora envía el mensaje a la clienta.");
  }

  async function handleDecline() {
    setLoading("decline");
    const res = await declineBonusAction(bonus.id);
    setLoading(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(true);
    toast.success("Bono rechazado.");
  }

  /**
   * D-26: clienta elige no usar el bono ya elegido (gesto para no afectar los
   * ingresos de la manicurista, "propina"). Reusa `declineBonusAction` — el
   * mismo estado 'declined' que "No enviar" — para no requerir un valor de
   * enum nuevo (evita la limitación de Drizzle con transacciones en D-18) y
   * porque 'declined' ya queda fuera de listPendingBonuses/getActiveBonusForClient.
   * Solo la manicurista la marca aquí; no se notifica nada a la clienta.
   */
  async function handleWaive() {
    setLoading("waive");
    const res = await declineBonusAction(bonus.id);
    setLoading(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(true);
    toast.success(
      "Bono marcado como no usado — queda como gesto para el negocio.",
    );
  }

  /**
   * D-27: eliminar un bono ya 'approved' (enviado a la clienta con su link,
   * pero ella todavía no eligió ni rechazó). Antes de esto no había forma de
   * quitarlo en ese estado intermedio. Misma transición a 'declined' que
   * "No enviar"/"No se usará" (D-26) — sin precondición de estado previo en
   * `declineBirthdayBonus`, así que no requiere cambios de backend. Si la
   * clienta ya tiene el link guardado y lo abre después, verá el mensaje
   * genérico de "tu regalo está siendo preparado" (mismo texto que un bono
   * 'declined' desde pending_manicurist) — no se le notifica el borrado.
   */
  async function handleDeleteApproved() {
    setLoading("delete");
    const res = await declineBonusAction(bonus.id);
    setLoading(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(true);
    toast.success("Bono eliminado.");
  }

  return (
    <li className="space-y-3 rounded-xl border p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{bonus.clientName}</p>
          <p className="text-muted-foreground text-sm">{bonus.clientPhone}</p>
        </div>
        <Badge
          className={
            bonus.status === "pending_manicurist"
              ? "bg-pink-100 text-pink-800"
              : bonus.status === "approved"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
          }
        >
          {STATUS_LABELS[bonus.status] ?? bonus.status}
        </Badge>
      </div>

      {/* Opción elegida */}
      {bonus.chosenLabel ? (
        <p className="text-sm">
          🎁 Regalo elegido:{" "}
          <span className="font-medium">{bonus.chosenLabel}</span>
        </p>
      ) : null}

      {/* Link de la clienta */}
      {bonus.status !== "pending_manicurist" ? (
        <p className="text-muted-foreground text-xs break-all">
          Link clienta:{" "}
          <Link
            href={`/cumpleanos/${bonus.publicToken}`}
            className="text-primary underline"
            target="_blank"
          >
            /cumpleanos/{bonus.publicToken.slice(0, 8)}…
          </Link>
        </p>
      ) : null}

      {/* Acciones */}
      {bonus.status === "pending_manicurist" ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={loading !== null}
            onClick={handleApprove}
          >
            {loading === "approve" ? "Aprobando…" : "✓ Enviar bono"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={loading !== null}
            onClick={handleDecline}
          >
            {loading === "decline" ? "…" : "✕ No enviar"}
          </Button>
        </div>
      ) : null}

      {/* Enviar WhatsApp + eliminar (cuando ya está aprobado, D-27) */}
      {bonus.status === "approved" ? (
        <div className="space-y-2">
          <Button asChild size="sm" className="w-full" variant="outline">
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-4" />
              Enviar mensaje de cumpleaños
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={loading !== null}
            onClick={handleDeleteApproved}
          >
            {loading === "delete" ? "Eliminando…" : "✕ Eliminar bono"}
          </Button>
        </div>
      ) : null}

      {/* No se usará (D-26) — solo cuando ya eligió regalo pero aún no lo
          redime en una cita. */}
      {bonus.status === "chosen" ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={loading !== null}
          onClick={handleWaive}
        >
          {loading === "waive" ? "Marcando…" : "🎁 No se usará"}
        </Button>
      ) : null}
    </li>
  );
}
