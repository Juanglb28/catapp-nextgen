"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { confirmCitaAction, rejectCitaAction } from "./actions";

type State =
  | { phase: "idle" }
  | { phase: "rejecting" }
  | { phase: "done"; decision: "accepted" | "rejected" }
  | { phase: "error"; message: string };

export function AppointmentConfirmation({
  token,
  initialConfirmation,
}: {
  token: string;
  initialConfirmation: "pending" | "accepted" | "rejected";
}) {
  const [state, setState] = useState<State>(
    initialConfirmation !== "pending"
      ? { phase: "done", decision: initialConfirmation }
      : { phase: "idle" },
  );
  const [rejectNote, setRejectNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmCitaAction(token);
      if (res.ok) {
        setState({ phase: "done", decision: "accepted" });
      } else {
        setState({ phase: "error", message: res.error });
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectCitaAction(token, rejectNote.trim() || null);
      if (res.ok) {
        setState({ phase: "done", decision: "rejected" });
      } else {
        setState({ phase: "error", message: res.error });
      }
    });
  }

  if (state.phase === "done") {
    if (state.decision === "accepted") {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold">¡Cita confirmada!</p>
            <p className="text-xs">Nos vemos pronto.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
        <XCircle className="size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Cita rechazada</p>
          <p className="text-xs">
            Tu manicurista recibirá tu respuesta. ¡Hasta pronto!
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "rejecting") {
    return (
      <div className="space-y-3 rounded-2xl border p-4">
        <p className="text-sm font-medium">¿Por qué no puedes ir?</p>
        <textarea
          className="placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          placeholder="(opcional) Cuéntale a tu manicurista..."
          rows={3}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          maxLength={300}
        />
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={isPending}
            onClick={() => setState({ phase: "idle" })}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            disabled={isPending}
            onClick={handleReject}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Rechazar cita"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.phase === "error" && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-xs">
          {state.message}
        </p>
      )}
      <div className="rounded-2xl border p-4">
        <p className="mb-3 text-center text-sm font-medium">
          ¿Confirmas tu asistencia?
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-rose-400 text-rose-600 hover:bg-rose-50"
            disabled={isPending}
            onClick={() => setState({ phase: "rejecting" })}
          >
            <XCircle className="size-4" />
            No puedo ir
          </Button>
          <Button
            className="flex-1 bg-green-600 text-white hover:bg-green-700"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="size-4" />
                Confirmar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
