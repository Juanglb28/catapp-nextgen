"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setAutoMessagesAction } from "@/modules/tenancy/actions";

/** Toggle de confirmaciones/recordatorios automáticos del negocio (F8.B2). */
export function AutoMessagesToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const r = await setAutoMessagesAction(next);
      if (!r.ok) {
        setOn(!next);
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
        checked={on}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">
          Confirmaciones y recordatorios automáticos
        </span>
        <span className="text-muted-foreground block text-sm">
          Envía por WhatsApp la confirmación al crear la cita y un recordatorio
          el día anterior. (Requiere configurar WhatsApp.)
        </span>
      </span>
    </label>
  );
}
