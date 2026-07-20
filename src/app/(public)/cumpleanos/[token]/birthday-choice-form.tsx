"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { chooseBonusOptionAction } from "@/modules/birthdays/actions";

/**
 * Formulario de elección del bono (D-19, B1.1). Las opciones ya no son fijas:
 * se listan las opciones activas del negocio, recibidas por props.
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
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setSelected(opt.id)}
          className={[
            "min-h-11 w-full rounded-2xl border-2 p-4 text-left transition-all",
            selected === opt.id
              ? "border-pink-500 bg-pink-50"
              : "border-border hover:border-pink-300",
          ].join(" ")}
        >
          <span className="text-2xl">🎁</span>
          <p className="mt-1 font-semibold">{opt.label}</p>
        </button>
      ))}

      <Button
        className="mt-2 min-h-11 w-full"
        disabled={!selected || loading}
        onClick={handleConfirm}
      >
        {loading ? "Confirmando…" : "¡Quiero este regalo! 🎁"}
      </Button>
    </div>
  );
}
