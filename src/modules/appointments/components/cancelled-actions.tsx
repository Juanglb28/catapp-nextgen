"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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

import { reactivateAppointmentAction } from "../actions";

/** Acción disponible para citas canceladas o completadas: reactivar. */
export function CancelledActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: "cancelled" | "completed";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const description =
    status === "completed"
      ? "Se marcará de nuevo como agendada. El historial de cambios quedará registrado."
      : "Volverá a quedar como agendada y podrás editarla normalmente.";

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateAppointmentAction(appointmentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("Cita reactivada");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <RotateCcw className="size-4" />
          Reactivar cita
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Reactivar esta cita?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button disabled={pending} onClick={handleReactivate}>
            {pending ? "Reactivando…" : "Sí, reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
