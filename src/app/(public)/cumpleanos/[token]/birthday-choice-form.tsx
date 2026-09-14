"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { chooseBonusOptionAction } from "@/modules/birthdays/actions";

/**
 * Formulario de elección del bono (D-19, B1.1). Las opciones ya no son fijas:
 * se listan las opciones activas del negocio, recibidas por props.
 *
 * Estilos propios en morado/rosa oscuro (D-30, solo esta pantalla pública),
 * en vez del componente `Button`/tokens compartidos (--primary es por
 * tenant/paleta, B6 — no encaja con el fondo fijo de esta experiencia).
 */
export function BirthdayChoiceForm({
  token,
  options,
}: {
  token: string;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    const res = await chooseBonusOptionAction(token, selected);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      {options.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSelected(opt.id)}
            className={[
              "flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all",
              isSelected
                ? "border-pink-400 bg-pink-500/15"
                : "border-white/15 bg-white/5 hover:border-pink-300/60",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">🎁</span>
              <span className="font-semibold text-white">{opt.label}</span>
            </span>
            <span
              aria-hidden
              className={[
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                isSelected
                  ? "border-pink-400 bg-pink-500 text-white"
                  : "border-white/25",
              ].join(" ")}
            >
              {isSelected && <Check className="size-3.5" />}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        disabled={!selected || loading}
        onClick={handleConfirm}
        className="mt-2 min-h-11 w-full rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 font-semibold text-white shadow-lg shadow-pink-900/30 transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? "Confirmando…" : "¡Quiero este regalo! 🎁"}
      </button>
    </div>
  );
}
