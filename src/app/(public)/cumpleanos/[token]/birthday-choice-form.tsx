"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { chooseBonusOptionAction } from "@/modules/birthdays/actions";
import { type BirthdayBonusOption } from "@/modules/birthdays/schema";

const OPTIONS: { value: BirthdayBonusOption; label: string; emoji: string }[] =
  [
    {
      value: "manicure_tradicional",
      label: "Manicure tradicional",
      emoji: "💅",
    },
    {
      value: "veloterapia_exfoliacion",
      label: "Veloterapia con exfoliación",
      emoji: "✨",
    },
  ];

export function BirthdayChoiceForm({ token }: { token: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<BirthdayBonusOption | null>(null);
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
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSelected(opt.value)}
          className={[
            "w-full rounded-2xl border-2 p-4 text-left transition-all",
            selected === opt.value
              ? "border-pink-500 bg-pink-50"
              : "border-border hover:border-pink-300",
          ].join(" ")}
        >
          <span className="text-2xl">{opt.emoji}</span>
          <p className="mt-1 font-semibold">{opt.label}</p>
        </button>
      ))}

      <Button
        className="mt-2 w-full"
        disabled={!selected || loading}
        onClick={handleConfirm}
      >
        {loading ? "Confirmando…" : "¡Quiero este regalo! 🎁"}
      </Button>
    </div>
  );
}
