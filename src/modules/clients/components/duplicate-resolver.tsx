"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { resolveDuplicatesAction } from "../actions";
import type { DuplicateClientGroup } from "../repository";

export function DuplicateResolver({
  groups,
}: {
  groups: DuplicateClientGroup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolvedPhones, setResolvedPhones] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const pending = groups.filter((g) => !resolvedPhones.has(g.phone));

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle className="size-12 text-green-600" />
        <p className="font-medium">Sin duplicados</p>
        <p className="text-muted-foreground text-sm">
          Todas las clientas están resueltas.
        </p>
        <Button variant="outline" onClick={() => router.push("/clientas")}>
          Volver a clientas
        </Button>
      </div>
    );
  }

  function handleKeep(group: DuplicateClientGroup, keepId: string) {
    setError(null);
    const discardClients = group.clients
      .filter((c) => c.id !== keepId)
      .map((c) => ({ id: c.id, appointmentCount: c.appointmentCount }));

    startTransition(async () => {
      const result = await resolveDuplicatesAction(keepId, discardClients);
      if (result.ok) {
        setResolvedPhones((prev) => new Set([...prev, group.phone]));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {pending.map((group) => {
        const maxCitas = Math.max(
          ...group.clients.map((c) => c.appointmentCount),
        );
        return (
          <div key={group.phone} className="overflow-hidden rounded-xl border">
            <div className="bg-muted/50 border-b px-4 py-2">
              <p className="text-muted-foreground text-xs font-medium">
                Teléfono duplicado
              </p>
              <p className="text-sm font-semibold">{group.phone}</p>
            </div>

            <ul className="divide-y">
              {group.clients.map((client) => {
                const hasCitas = client.appointmentCount > 0;
                const isSuggested =
                  client.appointmentCount === maxCitas && maxCitas > 0;
                return (
                  <li
                    key={client.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {client.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {client.appointmentCount}{" "}
                        {client.appointmentCount === 1 ? "cita" : "citas"} ·
                        Creada{" "}
                        {new Date(client.createdAt).toLocaleDateString(
                          "es-CO",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </p>
                      {client.email && (
                        <p className="text-muted-foreground truncate text-xs">
                          {client.email}
                        </p>
                      )}
                      {!hasCitas && (
                        <p className="mt-0.5 text-xs text-amber-600">
                          Se eliminará permanentemente si no la conservas
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleKeep(group, client.id)}
                      className={cn(
                        "flex-shrink-0",
                        isSuggested && "border-green-500 text-green-700",
                      )}
                    >
                      {isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Conservar"
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>

            <div className="bg-muted/30 space-y-0.5 border-t px-4 py-2">
              <p className="text-muted-foreground text-xs">
                Al conservar una, las otras se{" "}
                {group.clients.some((c) => c.appointmentCount > 0)
                  ? "archivarán (tienen citas) o eliminarán (sin citas)"
                  : "eliminarán permanentemente"}
                .
              </p>
              {group.clients.some((c) => c.appointmentCount > 0) && (
                <p className="text-muted-foreground text-xs">
                  El botón con borde verde tiene más historial.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
