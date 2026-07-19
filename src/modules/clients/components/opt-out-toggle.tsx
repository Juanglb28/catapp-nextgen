"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setClientOptOutAction } from "../actions";

/** Toggle de opt-out de mensajes automáticos de la clienta (F8.B2). */
export function OptOutToggle({
  clientId,
  initial,
}: {
  clientId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [optOut, setOptOut] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOptOut(next);
    startTransition(async () => {
      const r = await setClientOptOutAction(clientId, next);
      if (!r.ok) {
        setOptOut(!next);
        toast.error(r.error);
      }
      router.refresh();
    });
  }

  return (
    <label className="flex items-start gap-3 rounded-xl border p-3">
      <input
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={optOut}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">
          No enviar mensajes automáticos
        </span>
        <span className="text-muted-foreground block text-sm">
          Esta clienta no recibirá confirmaciones ni recordatorios automáticos.
        </span>
      </span>
    </label>
  );
}
