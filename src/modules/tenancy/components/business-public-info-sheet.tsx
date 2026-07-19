"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { updateBusinessPublicInfoAction } from "@/modules/tenancy/actions";

export function BusinessPublicInfoSheet({
  initial,
  trigger,
}: {
  initial: { publicAddress: string; publicNote: string };
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [publicAddress, setPublicAddress] = useState(initial.publicAddress);
  const [publicNote, setPublicNote] = useState(initial.publicNote);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPublicAddress(initial.publicAddress);
      setPublicNote(initial.publicNote);
      setError(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = await updateBusinessPublicInfoAction({
      publicAddress,
      publicNote,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Información actualizada");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Información pública</SheetTitle>
          <SheetDescription>
            Esto se muestra a tus clientas en el enlace de su cita. No incluyas
            datos privados.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="addr">Dirección</Label>
            <Input
              id="addr"
              placeholder="Calle 123 #45-67, Local 2"
              value={publicAddress}
              onChange={(e) => setPublicAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Nota para la clienta</Label>
            <Textarea
              id="note"
              rows={3}
              placeholder="Llega 5 minutos antes. Aceptamos transferencia."
              value={publicNote}
              onChange={(e) => setPublicNote(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
