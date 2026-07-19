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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { adjustStockAction } from "../actions";

/** Ajuste de stock: la usuaria cuenta el valor real y el sistema calcula el delta. */
export function AdjustStockSheet({
  productId,
  currentStock,
  unit,
  trigger,
}: {
  productId: string;
  currentStock: number;
  unit: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [real, setReal] = useState(String(currentStock));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const realNum = Number(real.replace(",", "."));
  const delta = Number.isFinite(realNum) ? realNum - currentStock : 0;

  async function submit() {
    if (!Number.isFinite(realNum) || realNum < 0) {
      toast.error("Ingresa un valor válido");
      return;
    }
    if (reason.trim() === "") {
      toast.error("Indica el motivo del ajuste");
      return;
    }
    setPending(true);
    const r = await adjustStockAction(productId, {
      realStock: realNum,
      reason: reason.trim(),
    });
    setPending(false);
    if (r.ok) {
      setOpen(false);
      toast.success("Stock ajustado");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Ajustar stock</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <p className="text-muted-foreground text-sm">
            Stock actual: {currentStock} {unit}. Ingresa lo que contaste de
            verdad.
          </p>
          <div className="space-y-2">
            <Label htmlFor="real">Stock real contado ({unit})</Label>
            <Input
              id="real"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={real}
              onChange={(e) => setReal(e.target.value)}
              autoFocus
            />
            {delta !== 0 ? (
              <p className="text-muted-foreground text-sm">
                Se registrará un ajuste de{" "}
                <span className="font-medium">
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>{" "}
                {unit}.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-reason">Motivo</Label>
            <Input
              id="adj-reason"
              placeholder="Conteo físico, rotura, error previo…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? "Guardando…" : "Guardar ajuste"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
