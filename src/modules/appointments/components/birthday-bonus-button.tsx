"use client";

import { Gift, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  applyBirthdayBonusAction,
  removeBirthdayBonusAction,
} from "../actions";

export function BirthdayBonusButton({
  appointmentId,
  mode,
  label,
}: {
  appointmentId: string;
  mode: "apply" | "remove";
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res =
      mode === "apply"
        ? await applyBirthdayBonusAction(appointmentId)
        : await removeBirthdayBonusAction(appointmentId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === "apply" ? "Bono aplicado" : "Bono quitado");
    router.refresh();
  }

  if (mode === "remove") {
    return (
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline disabled:opacity-50"
      >
        <X className="size-3" aria-hidden />
        {loading ? "…" : label}
      </button>
    );
  }

  return (
    <Button size="sm" onClick={run} disabled={loading}>
      <Gift className="size-4" aria-hidden />
      {loading ? "Aplicando…" : label}
    </Button>
  );
}
