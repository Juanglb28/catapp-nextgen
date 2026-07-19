"use client";

import { AlertTriangle, CalendarCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { retrySyncAction } from "../actions";

type Status = "ok" | "pending" | "error" | null;

/** Indicador discreto del estado de sync de la cita con Google Calendar (F5.B2). */
export function GcalSyncStatus({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: Status;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status === null) return null;

  if (status === "ok") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
        Sincronizada con Google Calendar
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-xs">
        Sincronizando con Google Calendar…
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-600/30 bg-amber-600/10 p-2">
      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        No se pudo sincronizar con Google Calendar.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await retrySyncAction(appointmentId);
            if (!r.ok) toast.error(r.error);
            router.refresh();
          })
        }
      >
        Reintentar
      </Button>
    </div>
  );
}
