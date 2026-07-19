"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/money";

import { editAppointmentAction } from "../actions";

type ServiceOption = { id: string; name: string; priceCop: number };

export function EditServicesSheet({
  appointmentId,
  serviceOptions,
  initialQty,
  overridden,
  currentTotal,
  trigger,
}: {
  appointmentId: string;
  serviceOptions: ServiceOption[];
  initialQty: Record<string, number>;
  overridden: boolean;
  currentTotal: number;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qtyById, setQtyById] = useState<Record<string, number>>(initialQty);
  const [overrideOn, setOverrideOn] = useState(overridden);
  const [overrideValue, setOverrideValue] = useState(currentTotal);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const byId = new Map(serviceOptions.map((s) => [s.id, s]));
  const subtotal = Object.entries(qtyById).reduce(
    (sum, [id, qty]) => sum + (byId.get(id)?.priceCop ?? 0) * qty,
    0,
  );
  const selectedCount = Object.values(qtyById).filter((q) => q > 0).length;

  function reset() {
    setQtyById(initialQty);
    setOverrideOn(overridden);
    setOverrideValue(currentTotal);
    setError(null);
  }

  function setQty(id: string, delta: number) {
    setQtyById((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function submit() {
    setError(null);
    const services = Object.entries(qtyById)
      .filter(([, q]) => q > 0)
      .map(([serviceId, quantity]) => ({ serviceId, quantity }));
    if (services.length === 0) {
      setError("La cita necesita al menos un servicio.");
      return;
    }
    setSubmitting(true);
    const result = await editAppointmentAction(appointmentId, {
      services,
      totalOverride: overrideOn ? overrideValue : null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Servicios actualizados");
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Servicios y total</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <ul className="space-y-2">
            {serviceOptions.map((s) => {
              const qty = qtyById[s.id] ?? 0;
              const active = qty > 0;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2",
                    active && "border-primary bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setQty(s.id, active ? -qty : 1)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatCOP(BigInt(s.priceCop))}
                    </p>
                  </button>
                  {active ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Menos"
                        onClick={() => setQty(s.id, -1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-6 text-center tabular-nums">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Más"
                        onClick={() => setQty(s.id, 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Plus
                      className="text-muted-foreground size-5"
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Total</Label>
              <span className="text-muted-foreground text-sm">
                Calculado: {formatCOP(BigInt(subtotal))}
              </span>
            </div>
            {overrideOn ? (
              <>
                <MoneyInput value={overrideValue} onChange={setOverrideValue} />
                <button
                  type="button"
                  onClick={() => setOverrideOn(false)}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Volver al total calculado
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOverrideOn(true);
                  setOverrideValue(subtotal);
                }}
                className="text-primary text-sm hover:underline"
              >
                Editar el total manualmente
              </button>
            )}
            {overrideOn ? (
              <p className="text-xs text-amber-700">
                Total editado manualmente: no se recalcula al cambiar servicios.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={submitting || selectedCount === 0}
            onClick={submit}
          >
            {submitting ? "Guardando…" : "Guardar servicios"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
