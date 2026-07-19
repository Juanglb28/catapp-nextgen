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

import { renderTemplate } from "@/modules/whatsapp/templates";

import {
  adjustPaymentAction,
  registerPaymentAction,
  updatePaymentMethodAction,
} from "../actions";
import { type ReceiptData } from "../receipt";
import { shareReceipt } from "../share-receipt";

type PaymentMethod = "efectivo" | "transferencia" | null;
type Mode = "register" | "adjust";

/**
 * Datos para enviar el comprobante al registrar el pago. `base` es el
 * comprobante "pagado en total"; si el pago queda como abono, se ajustan
 * `paidLabel`/`saldoLabel`/estado y el mensaje pasa a ser el recordatorio.
 */
export type PaymentReceipt = {
  base: ReceiptData;
  netTotalCop: number;
  alreadyPaidCop: number;
  phone: string;
  /** Texto de paz y salvo (ya renderizado) para el pago completo. */
  fullCaption: string;
  /** Plantilla cruda de recordatorio de pago (con placeholder {saldo}). */
  partialTemplate: string;
  clienta: string;
  negocio: string;
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RegisterPaymentSheet({
  appointmentId,
  defaultAmount,
  trigger,
  receipt,
  mode = "register",
  currentTip = 0,
  currentMethod = null,
}: {
  appointmentId: string;
  defaultAmount: number;
  trigger: ReactNode;
  /** Comprobante a compartir tras registrar el pago (solo modo register). */
  receipt?: PaymentReceipt;
  /** "register" suma un abono; "adjust" fija el monto pagado exacto. */
  mode?: Mode;
  currentTip?: number;
  currentMethod?: PaymentMethod;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount);
  const [tip, setTip] = useState(mode === "adjust" ? currentTip : 0);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(currentMethod);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdjust = mode === "adjust";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount(defaultAmount);
      setTip(isAdjust ? currentTip : 0);
      setPaymentMethod(currentMethod);
      setError(null);
    }
  }

  // El método de pago se guarda de forma independiente: marcarlo NO vuelve a
  // sumar un pago ya registrado (evita la duplicación del monto).
  async function selectMethod(next: PaymentMethod) {
    const prev = paymentMethod;
    setPaymentMethod(next);
    const result = await updatePaymentMethodAction(appointmentId, {
      paymentMethod: next,
    });
    if (!result.ok) {
      setPaymentMethod(prev);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = isAdjust
      ? await adjustPaymentAction(appointmentId, {
          amount,
          tip,
          paymentMethod,
        })
      : await registerPaymentAction(appointmentId, { amount, tip });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success(isAdjust ? "Pago ajustado" : "Pago registrado");

    // Enviar el comprobante por WhatsApp (solo al registrar pago).
    if (!isAdjust && receipt) {
      await sendReceipt(receipt, amount);
    }
    router.refresh();
  }

  /**
   * Comparte el comprobante tras registrar el pago. Si el pago salda la cita
   * envía el comprobante "Pagada" con el mensaje de paz y salvo; si es un abono,
   * envía el comprobante con el saldo pendiente y el recordatorio de pago.
   */
  async function sendReceipt(cfg: PaymentReceipt, paidNow: number) {
    const newPaid = cfg.alreadyPaidCop + paidNow;
    const fullyPaid = newPaid >= cfg.netTotalCop;

    const data: ReceiptData = fullyPaid
      ? cfg.base
      : {
          ...cfg.base,
          statusLabel: "Abono",
          statusTone: "warning",
          paidLabel: formatCOP(newPaid),
          saldoLabel: formatCOP(cfg.netTotalCop - newPaid),
        };

    const caption = fullyPaid
      ? cfg.fullCaption
      : renderTemplate(cfg.partialTemplate, {
          clienta: cfg.clienta,
          negocio: cfg.negocio,
          saldo: formatCOP(cfg.netTotalCop - newPaid),
        });

    try {
      const result = await shareReceipt(data, cfg.phone, caption);
      if (result === "downloaded") {
        toast.success("Comprobante descargado. Adjúntalo en WhatsApp.");
      }
    } catch {
      toast.error("No se pudo generar el comprobante.");
    }
  }

  const total = amount + tip;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle>
                {isAdjust ? "Ajustar pago" : "Registrar pago"}
              </SheetTitle>
              <SheetDescription>
                {isAdjust
                  ? "Corrige el monto pagado al valor exacto."
                  : "Se suma a lo ya pagado y actualiza el estado."}
              </SheetDescription>
            </div>
            {/* Método de pago (se guarda al instante) */}
            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  selectMethod(paymentMethod === "efectivo" ? null : "efectivo")
                }
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  paymentMethod === "efectivo"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground border"
                }`}
              >
                Efectivo
              </button>
              <button
                type="button"
                onClick={() =>
                  selectMethod(
                    paymentMethod === "transferencia" ? null : "transferencia",
                  )
                }
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  paymentMethod === "transferencia"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground border"
                }`}
              >
                Transferencia
              </button>
            </div>
          </div>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="pago">
              {isAdjust ? "Pagado (total)" : "Servicios"}
            </Label>
            <MoneyInput id="pago" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propina">Propina</Label>
            <MoneyInput id="propina" value={tip} onChange={setTip} />
          </div>
          {tip > 0 && (
            <>
              <hr className="border-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAdjust ? "Total" : "Total a registrar"}
                </span>
                <span className="font-medium">{formatCOP(total)}</span>
              </div>
            </>
          )}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting
              ? "Guardando…"
              : isAdjust
                ? "Guardar ajuste"
                : "Registrar pago"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
