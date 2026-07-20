"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MoneyInput } from "@/components/money-input";
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
import {
  createBonusOptionAction,
  updateBonusOptionAction,
} from "@/modules/birthdays/actions";

export type BonusOptionView = {
  id: string;
  label: string;
  discountCop: number;
  active: boolean;
};

/**
 * Gestión de las opciones de bono de cumpleaños del negocio (D-19, B1.1).
 * Reemplaza los dos valores fijos manicure/veloterapia por una lista editable:
 * cada opción tiene nombre + descuento, y puede activarse/desactivarse.
 */
export function BirthdayBonusSettingsSheet({
  options,
  trigger,
}: {
  options: BonusOptionView[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLabel("");
      setDiscount(0);
      setError(null);
    }
  }

  async function addOption() {
    setError(null);
    setBusy(true);
    const res = await createBonusOptionAction({
      label,
      discountCop: discount,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLabel("");
    setDiscount(0);
    toast.success("Opción agregada");
    router.refresh();
  }

  async function toggleActive(opt: BonusOptionView) {
    const res = await updateBonusOptionAction({ id: opt.id, active: !opt.active });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(opt.active ? "Opción desactivada" : "Opción activada");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Bono de cumpleaños</SheetTitle>
          <SheetDescription>
            Define las opciones de regalo que tus clientas pueden elegir, cada una
            con su descuento.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {options.length > 0 ? (
            <ul className="space-y-2">
              {options.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{opt.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(opt.discountCop)}
                      {opt.active ? "" : " · inactiva"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={() => toggleActive(opt)}
                  >
                    {opt.active ? "Desactivar" : "Activar"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aún no tienes opciones de bono. Agrega la primera abajo.
            </p>
          )}

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Agregar opción</p>
            <div className="space-y-2">
              <Label htmlFor="bono-label">Nombre</Label>
              <Input
                id="bono-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: Manicure tradicional"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bono-discount">Descuento</Label>
              <MoneyInput
                id="bono-discount"
                value={discount}
                onChange={setDiscount}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              className="min-h-11 w-full"
              disabled={busy || label.trim().length === 0}
              onClick={addOption}
            >
              {busy ? "Guardando…" : "Agregar opción"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
