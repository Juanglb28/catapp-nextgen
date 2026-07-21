import { formatDateTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";

/**
 * Etiquetas es-CO y formateo de la vista de detalle de cita (B4/R-C1). Extraídas
 * de `page.tsx` (era un god-file) para separar la presentación de la composición.
 */

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const CONFIRMATION_BADGE: Partial<
  Record<string, { label: string; cls: string }>
> = {
  accepted: {
    label: "✓ Confirmada",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "✕ Rechazada",
    cls: "bg-red-50 text-red-600 border-red-200",
  },
};

export const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pago pendiente",
  partial: "Abono",
  paid: "Pagada",
};

export const FIELD_LABEL: Record<string, string> = {
  total_cop: "Total",
  paid_cop: "Pago",
  tip_cop: "Propina",
  bonus_discount_cop: "Bono de cumpleaños",
  payment_method: "Método de pago",
  people_count: "Personas",
  status: "Estado",
  notes: "Notas",
  starts_at: "Inicio",
  ends_at: "Fin",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

/** Formatea el valor de un cambio de auditoría para mostrarlo en el historial. */
export function formatChangeValue(
  field: string,
  value: string | null,
  tz: string,
) {
  if (value === null || value === "") return "—";
  if (
    field === "total_cop" ||
    field === "paid_cop" ||
    field === "tip_cop" ||
    field === "bonus_discount_cop"
  ) {
    return formatCOP(BigInt(value));
  }
  if (field === "starts_at" || field === "ends_at") {
    return formatDateTime(new Date(value), tz);
  }
  if (field === "status") return STATUS_LABEL[value] ?? value;
  if (field === "payment_method") return PAYMENT_METHOD_LABEL[value] ?? value;
  return value;
}
