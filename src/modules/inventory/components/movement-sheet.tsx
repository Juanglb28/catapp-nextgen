"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/sheet";

import { registerMovementAction } from "../actions";

/** Mini-sheet de entrada/salida rápida de stock (F7.B2). */
export function MovementSheet({
  open,
  onOpenChange,
  productId,
  productName,
  unit,
  type,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  unit: string;
  type: "in" | "out";
  /** Recibe el delta con signo aplicado (para UI optimista). */
  onSuccess?: (delta: number) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity("1");
      setReason("");
    }
  }, [open]);

  const isOut = type === "out";

  async function submit() {
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    setPending(true);
    const r = await registerMovementAction(productId, {
      type,
      quantity: qty,
      reason: reason.trim() || undefined,
    });
    setPending(false);
    if (r.ok) {
      onSuccess?.(isOut ? -qty : qty);
      onOpenChange(false);
      toast.success(isOut ? "Salida registrada" : "Entrada registrada");
    } else {
      toast.error(r.error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>
            {isOut ? "Salida" : "Entrada"} · {productName}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2 px-4">
          <Label htmlFor="qty">Cantidad ({unit})</Label>
          <Input
            id="qty"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2 px-4">
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Input
            id="reason"
            placeholder={
              isOut ? "Uso en servicio, merma…" : "Compra, reposición…"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending
              ? "Guardando…"
              : isOut
                ? "Registrar salida"
                : "Registrar entrada"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
