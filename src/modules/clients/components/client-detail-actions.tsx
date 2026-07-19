"use client";

import { Archive, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { archiveClientAction } from "../actions";
import { type ClientFormInput } from "../validation";
import { ClientSheet } from "./client-sheet";

type Props = {
  clientId: string;
  values: ClientFormInput;
};

/** Acciones de la ficha: editar (sheet) y archivar (con confirmación). */
export function ClientDetailActions({ clientId, values }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveClientAction(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push("/clientas");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <ClientSheet
        client={{ id: clientId, values }}
        trigger={
          <Button variant="outline" size="sm" className="flex-1">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Archive className="size-4" />
            Archivar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Archivar a {values.name}?</DialogTitle>
            <DialogDescription>
              No aparecerá en tu lista de clientas, pero su historial de citas
              se conserva. Puedes restaurarla cuando quieras.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={onArchive}
            >
              {pending ? "Archivando…" : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
