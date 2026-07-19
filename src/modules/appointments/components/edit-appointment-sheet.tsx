"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { editAppointmentAction } from "../actions";

type Initial = {
  date: string;
  time: string;
  durationMin: number;
  peopleCount: number;
  notes: string;
};

/** Sheet para editar fecha/hora/duración, personas y notas. */
export function EditAppointmentSheet({
  appointmentId,
  initial,
  trigger,
}: {
  appointmentId: string;
  initial: Initial;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [durationMin, setDurationMin] = useState(initial.durationMin);
  const [peopleCount, setPeopleCount] = useState(initial.peopleCount);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDate(initial.date);
      setTime(initial.time);
      setDurationMin(initial.durationMin);
      setPeopleCount(initial.peopleCount);
      setNotes(initial.notes);
      setError(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = await editAppointmentAction(appointmentId, {
      date,
      time,
      durationMin,
      peopleCount,
      notes,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Cita actualizada");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar cita</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-date">Fecha</Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-time">Hora</Label>
              <Input
                id="e-time"
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-dur">Duración (minutos)</Label>
            <Input
              id="e-dur"
              type="number"
              inputMode="numeric"
              min={1}
              step={5}
              value={durationMin}
              onChange={(e) =>
                setDurationMin(
                  e.target.value === "" ? 0 : Number(e.target.value),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Personas atendidas</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Menos personas"
                onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center text-lg tabular-nums">
                {peopleCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Más personas"
                onClick={() => setPeopleCount((n) => Math.min(10, n + 1))}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-notes">Notas</Label>
            <Textarea
              id="e-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
