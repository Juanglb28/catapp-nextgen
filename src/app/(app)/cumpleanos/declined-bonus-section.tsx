"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { revertBonusAction } from "@/modules/birthdays/actions";

const RESTORE_LABELS: Record<string, string> = {
  pending_manicurist: "pendiente de tu aprobación",
  approved: "esperando elección de la clienta",
  chosen: "servicio elegido",
};

type DeclinedBonus = {
  id: string;
  clientName: string;
  clientPhone: string;
  declinedFromStatus: string | null;
};

/**
 * D-28: recuperar un bono eliminado por error ("No enviar", D-27 "Eliminar
 * bono" o D-26 "No se usará"). Colapsada por defecto para no ensuciar la
 * pantalla en el caso normal (nada que recuperar) — solo se renderiza si hay
 * al menos un bono revertible.
 */
export function DeclinedBonusesSection({
  bonuses,
}: {
  bonuses: DeclinedBonus[];
}) {
  const [open, setOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const visible = bonuses.filter((b) => !hiddenIds.includes(b.id));
  if (visible.length === 0) return null;

  async function handleRevert(id: string) {
    setLoadingId(id);
    const res = await revertBonusAction(id);
    setLoadingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHiddenIds((h) => [...h, id]);
    toast.success(
      "Bono restaurado. Ya puedes reenviar el link si corresponde.",
    );
  }

  return (
    <div className="rounded-xl border border-dashed">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <span>
          🗑️ {visible.length} bono{visible.length === 1 ? "" : "s"} eliminado
          {visible.length === 1 ? "" : "s"} — se puede recuperar
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <ul className="space-y-3 border-t px-4 py-3">
          {visible.map((bonus) => (
            <li
              key={bonus.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="text-sm">
                <p className="font-medium">{bonus.clientName}</p>
                <p className="text-muted-foreground text-xs">
                  {bonus.clientPhone}
                </p>
                {bonus.declinedFromStatus ? (
                  <p className="text-muted-foreground text-xs">
                    Volverá a:{" "}
                    {RESTORE_LABELS[bonus.declinedFromStatus] ??
                      bonus.declinedFromStatus}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingId !== null}
                onClick={() => handleRevert(bonus.id)}
              >
                {loadingId === bonus.id ? "…" : "↩ Revertir"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
