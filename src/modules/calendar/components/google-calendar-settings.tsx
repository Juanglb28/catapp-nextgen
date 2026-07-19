"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  backfillCalendarAction,
  disconnectGoogleAction,
  updateCalendarSettingsAction,
} from "../actions";

type Calendar = { id: string; name: string; primary: boolean };

export function GoogleCalendarSettings({
  email,
  calendars,
  currentCalendarId,
  syncEnabled,
}: {
  email: string;
  calendars: Calendar[];
  currentCalendarId: string;
  syncEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  function onCalendarChange(calendarId: string) {
    startTransition(async () => {
      const r = await updateCalendarSettingsAction({ calendarId });
      if (!r.ok) toast.error(r.error);
      else toast.success("Calendario actualizado");
      router.refresh();
    });
  }

  function onToggleSync(next: boolean) {
    startTransition(async () => {
      const r = await updateCalendarSettingsAction({ syncEnabled: next });
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function onDisconnect() {
    startTransition(async () => {
      await disconnectGoogleAction();
      setDisconnectOpen(false);
      toast.success("Google Calendar desconectado");
      router.refresh();
    });
  }

  function onBackfill() {
    startTransition(async () => {
      const r = await backfillCalendarAction();
      if (!r.ok) toast.error(r.error);
      else if (r.count === 0)
        toast.success("No hay citas pendientes de sincronizar");
      else toast.success(`${r.count} cita(s) sincronizada(s)`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-3 text-sm">
        <p className="text-muted-foreground">Conectado como</p>
        <p className="font-medium">{email}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cal">Calendario destino</Label>
        <Select
          value={currentCalendarId}
          disabled={pending}
          onValueChange={onCalendarChange}
        >
          <SelectTrigger id="cal" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {calendars.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.primary ? " (principal)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-start gap-3 rounded-xl border p-3">
        <input
          type="checkbox"
          className="accent-primary mt-0.5 size-4"
          checked={syncEnabled}
          disabled={pending}
          onChange={(e) => onToggleSync(e.target.checked)}
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">
            Sincronizar mis citas
          </span>
          <span className="text-muted-foreground block text-sm">
            Crea y actualiza los eventos en tu Google Calendar.
          </span>
        </span>
      </label>

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Sincronizar citas futuras</p>
        <p className="text-muted-foreground text-sm">
          Crea en tu calendario las citas agendadas que aún no estén
          sincronizadas.
        </p>
        <Button
          variant="outline"
          className="w-full"
          disabled={pending || !syncEnabled}
          onClick={onBackfill}
        >
          Sincronizar ahora
        </Button>
      </div>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="text-destructive"
            disabled={pending}
          >
            Desconectar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desconectar Google Calendar?</DialogTitle>
            <DialogDescription>
              Se revocará el acceso y se borrará la conexión. Tus citas en
              CatApp no se borran; solo dejan de sincronizarse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={onDisconnect}
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
