"use client";

import { Cake, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { syncBirthdaysFromContactsAction } from "../actions";

type SyncState =
  | { phase: "idle" }
  | { phase: "done"; updated: number; bonusFiredToday: number }
  | { phase: "error"; message: string };

export function SyncBirthdaysButton() {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<SyncState>({ phase: "idle" });

  function handleSync() {
    startTransition(async () => {
      setState({ phase: "idle" });
      const result = await syncBirthdaysFromContactsAction();
      if (result.ok) {
        setState({
          phase: "done",
          updated: result.data.updated,
          bonusFiredToday: result.data.bonusFiredToday,
        });
      } else {
        setState({ phase: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Cake className="mt-0.5 size-5 shrink-0 text-pink-500" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Sincronizar cumpleaños</p>
          <p className="text-muted-foreground text-xs">
            Actualiza la fecha de cumpleaños de clientas existentes usando los
            contactos de Google. Solo afecta a las que aún no tienen cumpleaños
            registrado.
          </p>
        </div>
      </div>

      {state.phase === "done" && (
        <div className="bg-muted space-y-0.5 rounded-lg px-3 py-2 text-sm">
          <p>
            <span className="font-medium">{state.updated}</span>{" "}
            {state.updated === 1
              ? "clienta actualizada"
              : "clientas actualizadas"}
            .
          </p>
          {state.bonusFiredToday > 0 && (
            <p className="font-medium text-pink-600">
              🎂 {state.bonusFiredToday}{" "}
              {state.bonusFiredToday === 1
                ? "bono de cumpleaños disparado"
                : "bonos de cumpleaños disparados"}{" "}
              hoy.
            </p>
          )}
          {state.updated === 0 && (
            <p className="text-muted-foreground text-xs">
              Todas las clientas ya tienen cumpleaños o no hay coincidencias en
              Contacts.
            </p>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <p className="text-destructive text-xs">{state.message}</p>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={handleSync}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Cake className="size-4" />
        )}
        {isPending ? "Sincronizando…" : "Sincronizar cumpleaños"}
      </Button>
    </div>
  );
}
