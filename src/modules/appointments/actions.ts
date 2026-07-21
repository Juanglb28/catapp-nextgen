"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import type { ActionResult } from "@/lib/action-result";
import { formatTime, tenantDayKey, tenantLocalToUtc } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { syncAppointment } from "@/modules/calendar/sync";
import { maybeSendAppointmentConfirmation } from "@/modules/whatsapp/auto-send";
import { getClient } from "@/modules/clients/repository";
import { listServicesByIds } from "@/modules/services/repository";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import {
  getActiveBonusForClient,
  getBonusOption,
} from "@/modules/birthdays/repository";

import { isLocked } from "./domain";
import {
  applyBonusDiscountAndRedeem,
  cancelAppointment,
  createAppointment,
  findOverlappingAppointments,
  getAppointment,
  reactivateAppointment,
  registerPayment,
  type ServiceLineInput,
  setBonusDiscount,
  setPaidAmount,
  updateAppointment,
  type UpdateAppointmentInput,
  updatePaymentMethod,
} from "./repository";
import {
  adjustPaymentSchema,
  createAppointmentFormSchema,
  editAppointmentSchema,
  registerPaymentSchema,
  setStatusSchema,
  updatePaymentMethodSchema,
} from "./validation";

export type CreateAppointmentResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: string;
      overlap?: { clientName: string; timeLabel: string };
    };

export async function createAppointmentAction(
  input: unknown,
): Promise<CreateAppointmentResult> {
  const { tenantId, userId } = await requireTenant();

  const parsed = createAppointmentFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  // Aislamiento: la clienta debe pertenecer al tenant. Se valida aquí para
  // devolver {ok:false} en vez de dejar que el repo lance (audit H-2, B2.3).
  const client = await getClient(tenantId, data.clientId);
  if (!client) {
    return { ok: false, error: "La clienta no pertenece a este negocio." };
  }

  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const startsAt = tenantLocalToUtc(data.date, data.time, tz);
  const endsAt = new Date(startsAt.getTime() + data.durationMin * 60_000);

  // Precios CONGELADOS desde el catálogo actual del tenant (D-10) y validación
  // de que los servicios existen y son del tenant (aislamiento).
  const ids = data.services.map((s) => s.serviceId);
  const catalog = await listServicesByIds(tenantId, ids);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const lines = [];
  for (const item of data.services) {
    const service = byId.get(item.serviceId);
    if (!service) {
      return {
        ok: false,
        error: "Uno de los servicios ya no está disponible.",
      };
    }
    lines.push({
      serviceId: service.id,
      priceCop: service.basePriceCop,
      quantity: item.quantity,
    });
  }

  // Advertencia de solape (no bloquea: el usuario puede forzar).
  if (!data.force) {
    const overlaps = await findOverlappingAppointments(
      tenantId,
      startsAt,
      endsAt,
    );
    if (overlaps.length > 0) {
      const other = overlaps[0];
      const otherClient = await getClient(tenantId, other.clientId);
      return {
        ok: false,
        error: "Esta cita se solapa con otra ya agendada.",
        overlap: {
          clientName: otherClient?.name ?? "otra clienta",
          timeLabel: formatTime(other.startsAt, tz),
        },
      };
    }
  }

  const appointment = await createAppointment(tenantId, {
    clientId: data.clientId,
    startsAt,
    endsAt,
    services: lines,
    peopleCount: data.peopleCount,
    notes: data.notes === "" ? null : data.notes,
    totalOverride:
      data.totalOverride === null ? undefined : BigInt(data.totalOverride),
  });

  // Pago inicial.
  if (data.payment.kind === "paid") {
    await registerPayment(
      tenantId,
      appointment.id,
      appointment.totalCop,
      userId,
    );
  } else if (data.payment.kind === "partial" && data.payment.amount > 0) {
    await registerPayment(
      tenantId,
      appointment.id,
      BigInt(data.payment.amount),
      userId,
    );
  }

  // Sincroniza con Google Calendar sin bloquear la respuesta (F5.B2).
  after(() =>
    syncAppointment(tenantId, appointment.id, { invite: data.inviteClient }),
  );
  // Confirmación automática por WhatsApp (F8.B2): respeta flag/toggle/opt-out.
  after(() => maybeSendAppointmentConfirmation(tenantId, appointment.id));

  revalidatePath("/citas");
  return { ok: true, id: appointment.id };
}


function revalidateAppointment(id: string) {
  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
  revalidatePath("/finanzas");
}

/**
 * Edición en vivo de una cita (F3.B4). Preserva los precios congelados de los
 * servicios ya presentes; congela el precio actual del catálogo solo para los
 * servicios nuevos. Rechaza la edición si la cita está completada o cancelada.
 */
export async function editAppointmentAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();

  const parsed = editAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const appointment = await getAppointment(tenantId, id);
  if (!appointment) return { ok: false, error: "No se encontró la cita." };
  if (isLocked(appointment.status)) {
    return {
      ok: false,
      error: "Una cita completada o cancelada no se puede editar.",
    };
  }

  const patch: UpdateAppointmentInput = {};

  // Servicios: precios congelados para los existentes, precio actual para nuevos.
  if (data.services !== undefined) {
    const frozen = new Map(
      appointment.services.map((s) => [s.serviceId, s.priceCop]),
    );
    const newIds = data.services
      .map((s) => s.serviceId)
      .filter((sid) => !frozen.has(sid));
    const catalog = await listServicesByIds(tenantId, newIds);
    const catalogPrice = new Map(catalog.map((s) => [s.id, s.basePriceCop]));

    const lines: ServiceLineInput[] = [];
    for (const item of data.services) {
      const price =
        frozen.get(item.serviceId) ?? catalogPrice.get(item.serviceId);
      if (price === undefined) {
        return {
          ok: false,
          error: "Uno de los servicios ya no está disponible.",
        };
      }
      lines.push({
        serviceId: item.serviceId,
        priceCop: price,
        quantity: item.quantity,
      });
    }
    patch.services = lines;
  }

  // Fecha/hora.
  if (data.date && data.time) {
    const tenant = await getTenant(tenantId);
    const tz = tenant?.timezone ?? "America/Bogota";
    const startsAt = tenantLocalToUtc(data.date, data.time, tz);
    const currentDuration = Math.round(
      (appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000,
    );
    const duration = data.durationMin ?? currentDuration;
    patch.startsAt = startsAt;
    patch.endsAt = new Date(startsAt.getTime() + duration * 60_000);
  }

  if (data.peopleCount !== undefined) patch.peopleCount = data.peopleCount;
  if (data.notes !== undefined)
    patch.notes = data.notes === "" ? null : data.notes;

  // Total: número = override; null = volver al calculado (recalcula desde los
  // servicios actuales si no se enviaron otros).
  if (data.totalOverride !== undefined) {
    if (data.totalOverride === null) {
      if (patch.services === undefined) {
        patch.services = appointment.services.map((s) => ({
          serviceId: s.serviceId,
          priceCop: s.priceCop,
          quantity: s.quantity,
        }));
      }
      // totalOverride se deja sin definir -> el repo recalcula.
    } else {
      patch.totalOverride = BigInt(data.totalOverride);
    }
  }

  const updated = await updateAppointment(tenantId, id, patch, userId);
  if (!updated) return { ok: false, error: "No se pudo actualizar la cita." };

  after(() => syncAppointment(tenantId, id, { invite: data.inviteClient }));

  revalidateAppointment(id);
  return { ok: true };
}

/** Registra un pago (siempre permitido, incluso en citas cerradas). */
export async function registerPaymentAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Monto inválido.",
    };
  }

  // Tope: el pago no puede exceder el saldo pendiente (neto = total − bono − pagado).
  // Evita registrar paid_cop > total, que inflaría los ingresos (QA B1). B2.1.
  const appointment = await getAppointment(tenantId, id);
  if (!appointment) return { ok: false, error: "No se encontró la cita." };
  const saldo =
    appointment.totalCop - appointment.bonusDiscountCop - appointment.paidCop;
  if (BigInt(parsed.data.amount) > saldo) {
    return {
      ok: false,
      error:
        saldo <= 0n
          ? "Esta cita ya está pagada."
          : `El monto excede el saldo pendiente (${formatCOP(saldo)}).`,
    };
  }

  const updated = await registerPayment(
    tenantId,
    id,
    BigInt(parsed.data.amount),
    userId,
    BigInt(parsed.data.tip),
    parsed.data.paymentMethod ?? null,
  );
  if (!updated) return { ok: false, error: "No se encontró la cita." };

  revalidateAppointment(id);
  return { ok: true };
}

/**
 * Ajusta (corrige) el pago a un valor EXACTO, sin sumar. Permite reparar un
 * pago duplicado o registrado por error y bajar el monto pagado.
 */
export async function adjustPaymentAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = adjustPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Monto inválido.",
    };
  }

  const updated = await setPaidAmount(
    tenantId,
    id,
    BigInt(parsed.data.amount),
    userId,
    {
      tip: BigInt(parsed.data.tip),
      paymentMethod: parsed.data.paymentMethod ?? null,
    },
  );
  if (!updated) return { ok: false, error: "No se encontró la cita." };

  revalidateAppointment(id);
  return { ok: true };
}

/** Actualiza solo el método de pago, sin tocar el monto pagado. */
export async function updatePaymentMethodAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = updatePaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Método inválido.",
    };
  }

  const updated = await updatePaymentMethod(
    tenantId,
    id,
    parsed.data.paymentMethod,
    userId,
  );
  if (!updated) return { ok: false, error: "No se encontró la cita." };

  revalidateAppointment(id);
  return { ok: true };
}

/**
 * Aplica el bono de cumpleaños elegido por la clienta como descuento de la cita.
 * B2.2: (1) el año del bono se resuelve en la TZ del tenant; (2) solo puede
 * aplicarse durante el MES de cumpleaños de la clienta (promesa "redimible en el
 * mes de tu cumpleaños"); (3) el descuento y la redención ocurren en UNA sola
 * transacción (todo-o-nada), sin dejar descuento aplicado con el bono sin consumir.
 */
export async function applyBirthdayBonusAction(
  id: string,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();

  const [appointment, tenant] = await Promise.all([
    getAppointment(tenantId, id),
    getTenant(tenantId),
  ]);
  if (!appointment) return { ok: false, error: "No se encontró la cita." };
  const tz = tenant?.timezone ?? "America/Bogota";

  const bonus = await getActiveBonusForClient(tenantId, appointment.clientId, tz);
  if (!bonus || bonus.status !== "chosen" || !bonus.chosenOptionId) {
    return { ok: false, error: "La clienta no tiene un bono elegido." };
  }

  // Caducidad (B2.2): solo redimible durante el mes de cumpleaños (TZ del tenant).
  const client = await getClient(tenantId, appointment.clientId);
  const birthdayMonth = client?.birthdayDate?.slice(5, 7);
  const currentMonth = tenantDayKey(new Date(), tz).slice(5, 7);
  if (birthdayMonth && birthdayMonth !== currentMonth) {
    return {
      ok: false,
      error: "El bono solo puede aplicarse durante el mes de cumpleaños.",
    };
  }

  // El descuento sale de la opción elegida (D-19, B1.1), no de columnas fijas.
  const option = await getBonusOption(tenantId, bonus.chosenOptionId);
  const value = option?.discountCop ?? 0n;

  if (value <= 0n) {
    return {
      ok: false,
      error: "Configura el valor de la opción en Ajustes → Bono de cumpleaños.",
    };
  }

  // Descuento + redención en UNA transacción (B2.2). Si el bono ya no está
  // 'chosen' (carrera), lanza y revierte todo.
  try {
    const updated = await applyBonusDiscountAndRedeem(tenantId, {
      appointmentId: id,
      bonusId: bonus.id,
      discountCop: value,
      changedBy: userId,
    });
    if (!updated) return { ok: false, error: "No se encontró la cita." };
  } catch {
    return { ok: false, error: "No se pudo aplicar el bono. Intenta de nuevo." };
  }

  revalidateAppointment(id);
  return { ok: true };
}

/** Quita el descuento de bono aplicado a la cita. */
export async function removeBirthdayBonusAction(
  id: string,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const updated = await setBonusDiscount(tenantId, id, 0n, userId);
  if (!updated) return { ok: false, error: "No se encontró la cita." };

  revalidateAppointment(id);
  return { ok: true };
}

/** Reactiva una cita cancelada, devolviéndola a 'scheduled'. */
export async function reactivateAppointmentAction(
  id: string,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();

  const appointment = await getAppointment(tenantId, id);
  if (!appointment) return { ok: false, error: "No se encontró la cita." };
  if (
    appointment.status !== "cancelled" &&
    appointment.status !== "completed"
  ) {
    return {
      ok: false,
      error: "Solo se pueden reactivar citas canceladas o completadas.",
    };
  }

  const updated = await reactivateAppointment(tenantId, id, userId);
  if (!updated) return { ok: false, error: "No se pudo reactivar la cita." };

  after(() => syncAppointment(tenantId, id));
  revalidateAppointment(id);
  return { ok: true };
}

/** Cambia el estado (completar / no asistió / cancelar). Solo desde 'scheduled'. */
export async function setAppointmentStatusAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { tenantId, userId } = await requireTenant();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Estado inválido." };
  }

  const appointment = await getAppointment(tenantId, id);
  if (!appointment) return { ok: false, error: "No se encontró la cita." };
  if (appointment.status !== "scheduled") {
    return { ok: false, error: "La cita ya no se puede cambiar." };
  }

  const updated =
    parsed.data.status === "cancelled"
      ? await cancelAppointment(tenantId, id, userId)
      : await updateAppointment(
          tenantId,
          id,
          { status: parsed.data.status },
          userId,
        );
  if (!updated) return { ok: false, error: "No se pudo cambiar el estado." };

  // Cancelar/no-show borra el evento; completar lo deja actualizado (F5.B2).
  after(() => syncAppointment(tenantId, id));

  revalidateAppointment(id);
  return { ok: true };
}
