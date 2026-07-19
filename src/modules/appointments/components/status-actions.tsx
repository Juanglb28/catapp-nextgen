"use client";

import { Check, UserX } from "lucide-react";
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

import { setAppointmentStatusAction } from "../actions";

/** Acciones de estado para citas agendadas: completar, no asistió, cancelar. */
export function StatusActions({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  function run(status: "completed" | "no_show" | "cancelled", okMsg: string) {
    startTransition(async () => {
      const result = await setAppointmentStatusAction(appointmentId, {
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCancelOpen(false);
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() => run("completed", "Cita completada")}
      >
        <Check className="size-4" />
        Completar
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run("no_show", "Marcada como no asistió")}
      >
        <UserX className="size-4" />
        No asistió
      </Button>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pending}
          >
            Cancelar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar esta cita?</DialogTitle>
            <DialogDescription>
              Quedará registrada como cancelada. Podrás seguir registrando
              pagos, pero no editarla.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run("cancelled", "Cita cancelada")}
            >
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
