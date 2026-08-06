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
  setAppointmentStatusAction,
} from "../actions";
import { type ReceiptData } from "../receipt";
import { shareReceipt } from "../share-receipt";

/** Método elegido en la UI. "ambos" = efectivo + transferencia (dos montos). */
type Method = "efectivo" | "transferencia" | "ambos" | null;
/** Método de método único como lo guarda la DB (combinado = null + desglose). */
type DbMethod = "efectivo" | "transferencia" | null;
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
  /** Propina ya registrada antes de este pago (COP); el form solo suma la nueva. */
  alreadyTipCop: number;
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

/** Etiqueta legible del método para el comprobante. */
function methodLabel(m: Method): string | null {
  if (m === "efectivo") return "Efectivo";
  if (m === "transferencia") return "Transferencia";
  if (m === "ambos") return "Efectivo y transferencia";
  return null;
}

export function RegisterPaymentSheet({
  appointmentId,
  defaultAmount,
  trigger,
  receipt,
  mode = "register",
  currentTip = 0,
  currentMethod = null,
  currentCash = 0,
  currentTransfer = 0,
  defaultOpen = false,
  completeOnSuccess = false,
}: {
  appointmentId: string;
  defaultAmount: number;
  trigger: ReactNode;
  /** Comprobante a compartir tras registrar el pago (solo modo register). */
  receipt?: PaymentReceipt;
  /** "register" suma un abono; "adjust" fija el monto pagado exacto. */
  mode?: Mode;
  currentTip?: number;
  currentMethod?: DbMethod;
  currentCash?: number;
  currentTransfer?: number;
  /** Abre el sheet al montar (para disparar el flujo desde otro botón). */
  defaultOpen?: boolean;
  /** Tras registrar el pago, marca la cita como completada (flujo "Completar"). */
  completeOnSuccess?: boolean;
}) {
  const router = useRouter();
  const isAdjust = mode === "adjust";

  // En ajuste, el método inicial refleja el estado actual. Combinado se detecta
  // por el desglose (ambos montos > 0); si no, por el método único guardado.
  const initialMethod: Method = isAdjust
    ? currentCash > 0 && currentTransfer > 0
      ? "ambos"
      : currentCash > 0
        ? "efectivo"
        : currentTransfer > 0
          ? "transferencia"
          : currentMethod
    : null;

  const [open, setOpen] = useState(defaultOpen);
  const [method, setMethod] = useState<Method>(initialMethod);
  const [cash, setCash] = useState(isAdjust ? currentCash : 0);
  const [transfer, setTransfer] = useState(isAdjust ? currentTransfer : 0);
  const [tip, setTip] = useState(isAdjust ? currentTip : 0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setMethod(initialMethod);
    setCash(isAdjust ? currentCash : 0);
    setTransfer(isAdjust ? currentTransfer : 0);
    setTip(isAdjust ? currentTip : 0);
    setError(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  /** Elige el método y precarga los montos (solo en registro). */
  function selectMethod(next: Method) {
    setError(null);
    setMethod(next);
    if (isAdjust) return;
    if (next === "efectivo") {
      setCash(defaultAmount);
      setTransfer(0);
    } else if (next === "transferencia") {
      setCash(0);
      setTransfer(defaultAmount);
    } else if (next === "ambos") {
      setCash(defaultAmount);
      setTransfer(0);
    }
  }

  // Montos efectivos según el método (transferencia fuerza efectivo=0 y vv.).
  const payloadCash = method === "transferencia" ? 0 : cash;
  const payloadTransfer = method === "efectivo" ? 0 : transfer;
  const total = payloadCash + payloadTransfer + tip;

  async function submit() {
    if (!method) {
      setError("Seleccione tipo de pago (efectivo, transferencia o ambos).");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = isAdjust
      ? await adjustPaymentAction(appointmentId, {
          cash: payloadCash,
          transfer: payloadTransfer,
          tip,
        })
      : await registerPaymentAction(appointmentId, {
          cash: payloadCash,
          transfer: payloadTransfer,
          tip,
        });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success(isAdjust ? "Pago ajustado" : "Pago registrado");

    // Enviar el comprobante por WhatsApp (solo al registrar pago).
    if (!isAdjust && receipt) {
      await sendReceipt(receipt, payloadCash + payloadTransfer, method);
    }

    // Flujo "Completar": tras registrar el pago, cierra la cita como completada.
    if (!isAdjust && completeOnSuccess) {
      const done = await setAppointmentStatusAction(appointmentId, {
        status: "completed",
      });
      if (done.ok) toast.success("Cita completada");
      else toast.error(done.error);
    }
    router.refresh();
  }

  /**
   * Comparte el comprobante tras registrar el pago. Si el pago salda la cita
   * envía el comprobante "Pagada" con el mensaje de paz y salvo; si es un abono,
   * envía el comprobante con el saldo pendiente y el recordatorio de pago.
   */
  async function sendReceipt(cfg: PaymentReceipt, paidNow: number, m: Method) {
    const newPaid = cfg.alreadyPaidCop + paidNow;
    const fullyPaid = newPaid >= cfg.netTotalCop;
    // La propina del formulario es un abono más (igual que cash/transfer): hay
    // que sumarla a la ya registrada, no reemplazarla. `cfg.base.tipLabel` es
    // el snapshot del servidor ANTES de este pago, por eso no sirve solo.
    const newTip = cfg.alreadyTipCop + tip;

    const data: ReceiptData = {
      ...cfg.base,
      methodLabel: methodLabel(m),
      tipLabel: newTip > 0 ? formatCOP(newTip) : null,
      ...(fullyPaid
        ? {}
        : {
            statusLabel: "Abono",
            statusTone: "warning",
            paidLabel: formatCOP(newPaid),
            saldoLabel: formatCOP(cfg.netTotalCop - newPaid),
          }),
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

  const methodButton = (value: Method, label: string) => (
    <button
      type="button"
      onClick={() => selectMethod(value)}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
        method === value
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border-border text-muted-foreground hover:text-foreground border"
      }`}
      aria-pressed={method === value}
    >
      {label}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>
            {isAdjust ? "Ajustar pago" : "Registrar pago"}
          </SheetTitle>
          <SheetDescription>
            {isAdjust
              ? "Corrige el monto pagado al valor exacto."
              : "Elige el método, ingresa el monto y registra el pago."}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {/* Paso 1: método de pago (obligatorio) */}
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="flex gap-2">
              {methodButton("efectivo", "Efectivo")}
              {methodButton("transferencia", "Transferencia")}
              {methodButton("ambos", "Ambos")}
            </div>
            {!method ? (
              <p className="text-muted-foreground text-xs">
                Selecciona un método para continuar.
              </p>
            ) : null}
          </div>

          {/* Paso 2: monto(s) según el método */}
          {method === "efectivo" ? (
            <div className="space-y-2">
              <Label htmlFor="efectivo">
                {isAdjust ? "Efectivo (total)" : "Efectivo"}
              </Label>
              <MoneyInput id="efectivo" value={cash} onChange={setCash} />
            </div>
          ) : null}

          {method === "transferencia" ? (
            <div className="space-y-2">
              <Label htmlFor="transferencia">
                {isAdjust ? "Transferencia (total)" : "Transferencia"}
              </Label>
              <MoneyInput
                id="transferencia"
                value={transfer}
                onChange={setTransfer}
              />
            </div>
          ) : null}

          {method === "ambos" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ambos-efectivo">Efectivo</Label>
                <MoneyInput
                  id="ambos-efectivo"
                  value={cash}
                  onChange={setCash}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ambos-transferencia">Transferencia</Label>
                <MoneyInput
                  id="ambos-transferencia"
                  value={transfer}
                  onChange={setTransfer}
                />
              </div>
            </>
          ) : null}

          {method ? (
            <div className="space-y-2">
              <Label htmlFor="propina">Propina</Label>
              <MoneyInput id="propina" value={tip} onChange={setTip} />
            </div>
          ) : null}

          {method ? (
            <>
              <hr className="border-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAdjust ? "Total" : "Total a registrar"}
                </span>
                <span className="font-medium">{formatCOP(total)}</span>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={submitting || !method}
            onClick={submit}
          >
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
