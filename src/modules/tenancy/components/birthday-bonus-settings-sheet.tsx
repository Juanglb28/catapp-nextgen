"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { updateBonusValuesAction } from "@/modules/tenancy/actions";

export function BirthdayBonusSettingsSheet({
  initial,
  trigger,
}: {
  initial: { bonusManicureCop: number; bonusVeloterapiaCop: number };
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manicure, setManicure] = useState(initial.bonusManicureCop);
  const [veloterapia, setVeloterapia] = useState(initial.bonusVeloterapiaCop);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setManicure(initial.bonusManicureCop);
      setVeloterapia(initial.bonusVeloterapiaCop);
      setError(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = await updateBonusValuesAction({
      bonusManicureCop: manicure,
      bonusVeloterapiaCop: veloterapia,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Valores del bono actualizados");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Bono de cumpleaños</SheetTitle>
          <SheetDescription>
            Define cuánto se descuenta al aplicar cada bono en una cita.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="bono-manicure">Manicure tradicional</Label>
            <MoneyInput
              id="bono-manicure"
              value={manicure}
              onChange={setManicure}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bono-veloterapia">
              Veloterapia con exfoliación
            </Label>
            <MoneyInput
              id="bono-veloterapia"
              value={veloterapia}
              onChange={setVeloterapia}
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
