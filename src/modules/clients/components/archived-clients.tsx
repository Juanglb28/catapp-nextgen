"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhoneCO } from "@/lib/phone";

import { restoreClientAction } from "../actions";
import { type Client } from "../schema";

/** Sección colapsada con las clientas archivadas y opción de restaurar. */
export function ArchivedClients({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (clients.length === 0) return null;

  function onRestore(id: string) {
    startTransition(async () => {
      await restoreClientAction(id);
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground flex w-full items-center justify-between py-2 text-sm font-medium"
      >
        <span>Archivadas ({clients.length})</span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="space-y-2">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground truncate font-medium">
                  {client.name}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {formatPhoneCO(client.phone)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onRestore(client.id)}
              >
                <RotateCcw className="size-4" />
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
