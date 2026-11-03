import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";

import { tenantDayRangeUtc } from "@/lib/dates";
import { db } from "@/lib/db";
// Solo el schema (tabla) de birthdays, para redimir el bono en la misma
// transacción que el descuento (B2.2). No importa código de birthdays → sin ciclo.
import { birthdayBonuses } from "@/modules/birthdays/schema";
import { type Client, clients } from "@/modules/clients/schema";
import { type Service, services } from "@/modules/services/schema";
import { tenants } from "@/modules/tenancy/schema";

import {
  type AppointmentStatus,
  computeTotal,
  derivePaymentStatus,
  validateTimeRange,
} from "./domain";
import {
  type Appointment,
  type AppointmentChange,
  type AppointmentPerson,
  type AppointmentService,
  appointmentChanges,
  appointmentPeople,
  appointmentPersonServices,
  appointmentServices,
  appointments,
} from "./schema";

export * from "./repository-public";

/**
 * Repositorio de citas — alcance de tenant obligatorio (D-11). Mutaciones que
 * tocan varias tablas van en transacción. Auditoría de cambios en
 * `appointment_changes` (RF-02). Dinero en `bigint`; fechas UTC.
 */

export type ServiceLineInput = {
  serviceId: string;
  priceCop: bigint;
  quantity?: number;
};

/** Una persona atendida y los servicios (por id) que recibió. */
export type PersonInput = { name: string; serviceIds: string[] };

export type CreateAppointmentInput = {
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  services: ServiceLineInput[];
  peopleCount?: number;
  /** Desglose por persona (comprobante discriminado). Ver `PersonInput`. */
  people?: PersonInput[];
  notes?: string | null;
  /** Override manual del total (negociación en vivo). Si no, se calcula. */
  totalOverride?: bigint | null;
  status?: AppointmentStatus;
};

export type AppointmentPersonDetails = AppointmentPerson & {
  serviceIds: string[];
};

export type AppointmentDetails = Appointment & {
  client: Client;
  services: (AppointmentService & { service: Service })[];
  /** Desglose por persona (comprobante discriminado). Vacío si no aplica. */
  people: AppointmentPersonDetails[];
};

/** Crea la cita y sus servicios en una transacción. */
export async function createAppointment(
  tenantId: string,
  data: CreateAppointmentInput,
): Promise<Appointment> {
  if (!validateTimeRange(data.startsAt, data.endsAt)) {
    throw new Error("La cita debe terminar después de empezar.");
  }

  const lines = data.services.map((s) => ({
    serviceId: s.serviceId,
    priceCop: s.priceCop,
    quantity: s.quantity ?? 1,
  }));
  const total = computeTotal(lines, data.totalOverride);
  const payment = derivePaymentStatus(total, 0n);

  return db.transaction(async (tx) => {
    // La clienta debe pertenecer al mismo tenant (aislamiento).
    const [client] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.tenantId, tenantId)))
      .limit(1);
    if (!client) {
      throw new Error("La clienta no pertenece a este negocio.");
    }

    const [appointment] = await tx
      .insert(appointments)
      .values({
        tenantId,
        clientId: data.clientId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status ?? "scheduled",
        paymentStatus: payment,
        totalCop: total,
        paidCop: 0n,
        peopleCount: data.peopleCount ?? 1,
        notes: data.notes ?? null,
      })
      .returning();

    if (lines.length > 0) {
      await tx.insert(appointmentServices).values(
        lines.map((l) => ({
          appointmentId: appointment.id,
          serviceId: l.serviceId,
          priceCop: l.priceCop,
          quantity: l.quantity,
        })),
      );
    }

    // Desglose por persona (comprobante discriminado, ítem nuevo). Solo si
    // vino gente (peopleCount > 1 en el formulario); con 1 persona no se
    // guarda nada aquí.
    if (data.people && data.people.length > 0) {
      const insertedPeople = await tx
        .insert(appointmentPeople)
        .values(
          data.people.map((p, i) => ({
            appointmentId: appointment.id,
            name: p.name,
            orderIndex: i,
          })),
        )
        .returning();

      const personServiceRows = insertedPeople.flatMap((person, i) =>
        data.people![i].serviceIds.map((serviceId) => ({
          appointmentId: appointment.id,
          personId: person.id,
          serviceId,
          quantity: 1,
        })),
      );
      if (personServiceRows.length > 0) {
        await tx.insert(appointmentPersonServices).values(personServiceRows);
      }
    }

    return appointment;
  });
}

/** Cita por id (con clienta y servicios), solo si pertenece al tenant. */
export async function getAppointment(
  tenantId: string,
  id: string,
): Promise<AppointmentDetails | null> {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1);
  if (!appointment) return null;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, appointment.clientId))
    .limit(1);

  const lines = await db
    .select({ line: appointmentServices, service: services })
    .from(appointmentServices)
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(eq(appointmentServices.appointmentId, id));

  // Desglose por persona (comprobante discriminado, ítem nuevo). La mayoría
  // de citas (1 persona) no tiene filas aquí.
  const people = await db
    .select()
    .from(appointmentPeople)
    .where(eq(appointmentPeople.appointmentId, id))
    .orderBy(asc(appointmentPeople.orderIndex));
  const personServiceRows = people.length
    ? await db
        .select()
        .from(appointmentPersonServices)
        .where(eq(appointmentPersonServices.appointmentId, id))
    : [];

  return {
    ...appointment,
    client,
    services: lines.map((r) => ({ ...r.line, service: r.service })),
    people: people.map((p) => ({
      ...p,
      serviceIds: personServiceRows
        .filter((r) => r.personId === p.id)
        .map((r) => r.serviceId),
    })),
  };
}

/** Citas de un día concreto en la TZ del tenant (frontera correcta, ej. 23:00). */
export async function listAppointmentsByDay(
  tenantId: string,
  dayKey: string,
  tz: string,
): Promise<Appointment[]> {
  const { start, end } = tenantDayRangeUtc(dayKey, tz);
  return listAppointmentsByRange(tenantId, start, end);
}

/** Citas cuyo inicio cae en `[start, end)` (UTC). */
export async function listAppointmentsByRange(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<Appointment[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

/**
 * Referencias (id de cita + id de clienta) de las citas NO canceladas cuyo
 * inicio cae en `[start, end)`, para el manifiesto de descarga offline (D-35).
 */
export async function listAppointmentRefsInRange(
  tenantId: string,
  start: Date,
  end: Date,
  limit: number,
): Promise<{ id: string; clientId: string }[]> {
  return db
    .select({ id: appointments.id, clientId: appointments.clientId })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
        ne(appointments.status, "cancelled"),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(limit);
}

/**
 * Citas del tenant (no canceladas) que se solapan con `[startsAt, endsAt)`.
 * Dos rangos se solapan si `existente.starts < nuevo.ends` y
 * `existente.ends > nuevo.starts`. Se puede excluir una cita (al editar).
 */
export type AgendaAppointment = Appointment & {
  clientName: string;
  clientPhone: string;
  serviceSummary: { name: string; quantity: number }[];
};

/**
 * Citas de un rango `[start, end)` (UTC) con el nombre de la clienta y un
 * resumen de servicios, para la agenda. Tenant-scoped.
 */
export async function listAppointmentsForAgenda(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<AgendaAppointment[]> {
  const rows = await db
    .select({
      appt: appointments,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .orderBy(asc(appointments.startsAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.appt.id);
  const lines = await db
    .select({
      appointmentId: appointmentServices.appointmentId,
      name: services.name,
      quantity: appointmentServices.quantity,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(inArray(appointmentServices.appointmentId, ids));

  const byAppt = new Map<string, { name: string; quantity: number }[]>();
  for (const line of lines) {
    const bucket = byAppt.get(line.appointmentId);
    const entry = { name: line.name, quantity: line.quantity };
    if (bucket) bucket.push(entry);
    else byAppt.set(line.appointmentId, [entry]);
  }

  return rows.map((r) => ({
    ...r.appt,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    serviceSummary: byAppt.get(r.appt.id) ?? [],
  }));
}

/**
 * ¿Hay al menos una cita `scheduled` en el rango? (B0.3). Para el badge "mañana"
 * de /citas, que antes cargaba la agenda completa (2 queries con joins) solo para
 * un booleano. Usa el índice parcial `appointments_scheduled_starts_idx`.
 */
export async function hasScheduledInRange(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ exists: sql<boolean>`true` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "scheduled"),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * Historial de citas de una clienta (orden descendente por inicio, paginado).
 * Devuelve `hasMore` para saber si hay otra página. Tenant-scoped.
 */
export async function listAppointmentsByClient(
  tenantId: string,
  clientId: string,
  opts?: { page?: number; pageSize?: number },
): Promise<{ items: AgendaAppointment[]; hasMore: boolean }> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts?.pageSize ?? 10));

  const rows = await db
    .select({
      appt: appointments,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.clientId, clientId),
      ),
    )
    .orderBy(desc(appointments.startsAt))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  if (pageRows.length === 0) return { items: [], hasMore: false };

  const ids = pageRows.map((r) => r.appt.id);
  const lines = await db
    .select({
      appointmentId: appointmentServices.appointmentId,
      name: services.name,
      quantity: appointmentServices.quantity,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(inArray(appointmentServices.appointmentId, ids));

  const byAppt = new Map<string, { name: string; quantity: number }[]>();
  for (const line of lines) {
    const bucket = byAppt.get(line.appointmentId);
    const entry = { name: line.name, quantity: line.quantity };
    if (bucket) bucket.push(entry);
    else byAppt.set(line.appointmentId, [entry]);
  }

  const items = pageRows.map((r) => ({
    ...r.appt,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    serviceSummary: byAppt.get(r.appt.id) ?? [],
  }));
  return { items, hasMore };
}

export type ClientAppointmentStats = {
  count: number;
  totalPaidCop: bigint;
  outstandingCop: bigint;
};

/**
 * Totales de una clienta: nº de citas (sin canceladas), total pagado y saldo
 * pendiente acumulado (suma de saldos positivos). Tenant-scoped.
 */
export async function clientAppointmentStats(
  tenantId: string,
  clientId: string,
): Promise<ClientAppointmentStats> {
  const rows = await db
    .select({
      totalCop: appointments.totalCop,
      paidCop: appointments.paidCop,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.clientId, clientId),
      ),
    );

  let count = 0;
  let totalPaidCop = 0n;
  let outstandingCop = 0n;
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    count += 1;
    totalPaidCop += row.paidCop;
    const outstanding = row.totalCop - row.paidCop;
    if (outstanding > 0n) outstandingCop += outstanding;
  }
  return { count, totalPaidCop, outstandingCop };
}

export async function findOverlappingAppointments(
  tenantId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<Appointment[]> {
  const conditions = [
    eq(appointments.tenantId, tenantId),
    ne(appointments.status, "cancelled"),
    lt(appointments.startsAt, endsAt),
    gt(appointments.endsAt, startsAt),
  ];
  if (excludeId) conditions.push(ne(appointments.id, excludeId));
  return db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt));
}

/**
 * Cita EXACTA duplicada: misma clienta a la MISMA hora de inicio (no cancelada).
 * Distinta del solape (que compara rangos de cualquier clienta): esto bloquea el
 * registro repetido de la misma cita. Devuelve la primera coincidencia o null.
 */
export async function findDuplicateForClient(
  tenantId: string,
  clientId: string,
  startsAt: Date,
): Promise<Appointment | null> {
  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.clientId, clientId),
        eq(appointments.startsAt, startsAt),
        ne(appointments.status, "cancelled"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type UpdateAppointmentInput = {
  startsAt?: Date;
  endsAt?: Date;
  status?: AppointmentStatus;
  peopleCount?: number;
  notes?: string | null;
  services?: ServiceLineInput[];
  /** Override explícito del total. Si se omite, no se toca (salvo recálculo). */
  totalOverride?: bigint | null;
};

/**
 * Actualiza una cita en transacción: aplica cambios, recalcula el total si
 * cambian los servicios (salvo override), y escribe UNA fila en
 * `appointment_changes` por CADA campo modificado (valores legibles).
 */
export async function updateAppointment(
  tenantId: string,
  id: string,
  patch: UpdateAppointmentInput,
  changedBy: string | null,
): Promise<Appointment | null> {
  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1);
  if (!current) return null;

  const nextStartsAt = patch.startsAt ?? current.startsAt;
  const nextEndsAt = patch.endsAt ?? current.endsAt;
  if (!validateTimeRange(nextStartsAt, nextEndsAt)) {
    throw new Error("La cita debe terminar después de empezar.");
  }

  return db.transaction(async (tx) => {
    // Servicios: si vienen, se reemplazan por completo.
    let nextTotal = current.totalCop;
    if (patch.services !== undefined) {
      const lines = patch.services.map((s) => ({
        serviceId: s.serviceId,
        priceCop: s.priceCop,
        quantity: s.quantity ?? 1,
      }));
      await tx
        .delete(appointmentServices)
        .where(eq(appointmentServices.appointmentId, id));
      // Desglose por persona (comprobante discriminado): se borra al editar
      // los servicios, porque ya no hay garantía de que siga correspondiendo
      // con la lista nueva (ver comentario en schema.ts). `onDelete: cascade`
      // en appointment_person_services.person_id se encarga de esas filas.
      await tx
        .delete(appointmentPeople)
        .where(eq(appointmentPeople.appointmentId, id));
      if (lines.length > 0) {
        await tx.insert(appointmentServices).values(
          lines.map((l) => ({
            appointmentId: id,
            serviceId: l.serviceId,
            priceCop: l.priceCop,
            quantity: l.quantity,
          })),
        );
      }
      if (patch.totalOverride === undefined) {
        nextTotal = computeTotal(lines);
      }
    }
    if (patch.totalOverride !== undefined) {
      nextTotal = patch.totalOverride ?? nextTotal;
    }

    const nextNotes = patch.notes !== undefined ? patch.notes : current.notes;
    const nextStatus = patch.status ?? current.status;
    const nextPeople = patch.peopleCount ?? current.peopleCount;
    const nextPayment = derivePaymentStatus(
      nextTotal - current.bonusDiscountCop,
      current.paidCop,
    );

    // Auditoría: una fila por campo escalar modificado.
    const changes: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];
    if (nextStartsAt.getTime() !== current.startsAt.getTime()) {
      changes.push({
        field: "starts_at",
        oldValue: current.startsAt.toISOString(),
        newValue: nextStartsAt.toISOString(),
      });
    }
    if (nextEndsAt.getTime() !== current.endsAt.getTime()) {
      changes.push({
        field: "ends_at",
        oldValue: current.endsAt.toISOString(),
        newValue: nextEndsAt.toISOString(),
      });
    }
    if (nextStatus !== current.status) {
      changes.push({
        field: "status",
        oldValue: current.status,
        newValue: nextStatus,
      });
    }
    if (nextPeople !== current.peopleCount) {
      changes.push({
        field: "people_count",
        oldValue: String(current.peopleCount),
        newValue: String(nextPeople),
      });
    }
    if ((nextNotes ?? null) !== (current.notes ?? null)) {
      changes.push({
        field: "notes",
        oldValue: current.notes ?? null,
        newValue: nextNotes ?? null,
      });
    }
    if (nextTotal !== current.totalCop) {
      changes.push({
        field: "total_cop",
        oldValue: String(current.totalCop),
        newValue: String(nextTotal),
      });
    }

    // Si cambia el inicio, sube el SEQUENCE para que el .ics actualice el evento.
    const startsChanged = nextStartsAt.getTime() !== current.startsAt.getTime();
    const [updated] = await tx
      .update(appointments)
      .set({
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        status: nextStatus,
        peopleCount: nextPeople,
        notes: nextNotes,
        totalCop: nextTotal,
        paymentStatus: nextPayment,
        sequence: startsChanged ? current.sequence + 1 : current.sequence,
        updatedAt: new Date(),
      })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    if (changes.length > 0) {
      await tx.insert(appointmentChanges).values(
        changes.map((c) => ({
          appointmentId: id,
          changedBy,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      );
    }

    return updated;
  });
}

/**
 * Suma un pago a la cita y deriva el estado de pago. ATÓMICO (B2.1): la fila se
 * lee con `FOR UPDATE` DENTRO de la transacción, así dos pagos concurrentes se
 * serializan y ninguno pisa al otro (antes el read-modify-write fuera de la tx
 * perdía un pago — QA B1).
 */
export async function registerPayment(
  tenantId: string,
  id: string,
  amount: bigint,
  changedBy: string | null = null,
  tip: bigint = 0n,
  opts: {
    /** Parte del abono recibida en efectivo (COP). */
    cash?: bigint;
    /** Parte del abono recibida por transferencia (COP). */
    transfer?: bigint;
    /** Método explícito cuando NO se envía desglose (etiquetado directo). */
    paymentMethod?: "efectivo" | "transferencia" | null;
  } = {},
): Promise<Appointment | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .for("update")
      .limit(1);
    if (!current) return null;

    const addCash = opts.cash ?? 0n;
    const addTransfer = opts.transfer ?? 0n;
    const nextPaid = current.paidCop + amount;
    const nextCash = current.cashCop + addCash;
    const nextTransfer = current.transferCop + addTransfer;
    const nextTip = current.tipCop + tip;
    const nextPayment = derivePaymentStatus(
      current.totalCop - current.bonusDiscountCop,
      nextPaid,
    );

    // Método: con desglose se DERIVA de los acumulados. Combinado (ambos > 0)
    // => null (el desglose lo representan cash_cop/transfer_cop). Sin desglose,
    // se usa el explícito o se conserva el actual.
    const splitProvided =
      opts.cash !== undefined || opts.transfer !== undefined;
    const nextMethod = splitProvided
      ? nextCash > 0n && nextTransfer > 0n
        ? null
        : nextCash > 0n
          ? "efectivo"
          : nextTransfer > 0n
            ? "transferencia"
            : current.paymentMethod
      : opts.paymentMethod !== undefined
        ? opts.paymentMethod
        : current.paymentMethod;

    const [updated] = await tx
      .update(appointments)
      .set({
        paidCop: nextPaid,
        cashCop: nextCash,
        transferCop: nextTransfer,
        tipCop: nextTip,
        paymentStatus: nextPayment,
        paymentMethod: nextMethod,
        updatedAt: new Date(),
      })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    await tx.insert(appointmentChanges).values({
      appointmentId: id,
      changedBy,
      field: "paid_cop",
      oldValue: String(current.paidCop),
      newValue: String(nextPaid),
    });

    if (tip > 0n) {
      await tx.insert(appointmentChanges).values({
        appointmentId: id,
        changedBy,
        field: "tip_cop",
        oldValue: String(current.tipCop),
        newValue: String(nextTip),
      });
    }

    return updated;
  });
}

/**
 * Ajusta el monto pagado a un valor EXACTO (corrección), recalcula el estado
 * de pago y deja auditoría. A diferencia de `registerPayment`, no suma: fija el
 * valor. Útil para corregir errores (p. ej. un pago duplicado). Opcionalmente
 * fija también la propina y el método de pago.
 */
export async function setPaidAmount(
  tenantId: string,
  id: string,
  paidCop: bigint,
  changedBy: string | null = null,
  opts: {
    tip?: bigint;
    /** Valor EXACTO de efectivo (COP). Si se omite, no se toca. */
    cash?: bigint;
    /** Valor EXACTO de transferencia (COP). Si se omite, no se toca. */
    transfer?: bigint;
    paymentMethod?: "efectivo" | "transferencia" | null;
  } = {},
): Promise<Appointment | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .for("update")
      .limit(1);
    if (!current) return null;

    const nextPaid = paidCop < 0n ? 0n : paidCop;
    const nextTip = opts.tip === undefined ? current.tipCop : opts.tip;
    const splitProvided =
      opts.cash !== undefined || opts.transfer !== undefined;
    const nextCash =
      opts.cash === undefined
        ? current.cashCop
        : opts.cash < 0n
          ? 0n
          : opts.cash;
    const nextTransfer =
      opts.transfer === undefined
        ? current.transferCop
        : opts.transfer < 0n
          ? 0n
          : opts.transfer;
    const nextMethod = splitProvided
      ? nextCash > 0n && nextTransfer > 0n
        ? null
        : nextCash > 0n
          ? "efectivo"
          : nextTransfer > 0n
            ? "transferencia"
            : opts.paymentMethod !== undefined
              ? opts.paymentMethod
              : current.paymentMethod
      : opts.paymentMethod !== undefined
        ? opts.paymentMethod
        : current.paymentMethod;
    const nextPayment = derivePaymentStatus(
      current.totalCop - current.bonusDiscountCop,
      nextPaid,
    );

    const [updated] = await tx
      .update(appointments)
      .set({
        paidCop: nextPaid,
        cashCop: nextCash,
        transferCop: nextTransfer,
        tipCop: nextTip,
        paymentStatus: nextPayment,
        paymentMethod: nextMethod,
        updatedAt: new Date(),
      })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    if (nextPaid !== current.paidCop) {
      await tx.insert(appointmentChanges).values({
        appointmentId: id,
        changedBy,
        field: "paid_cop",
        oldValue: String(current.paidCop),
        newValue: String(nextPaid),
      });
    }

    if (nextTip !== current.tipCop) {
      await tx.insert(appointmentChanges).values({
        appointmentId: id,
        changedBy,
        field: "tip_cop",
        oldValue: String(current.tipCop),
        newValue: String(nextTip),
      });
    }

    return updated;
  });
}

/**
 * Actualiza solo el método de pago, sin tocar montos. Evita que marcar un
 * método vuelva a sumar un pago ya registrado (bug de duplicación).
 */
export async function updatePaymentMethod(
  tenantId: string,
  id: string,
  paymentMethod: "efectivo" | "transferencia" | null,
  changedBy: string | null = null,
): Promise<Appointment | null> {
  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1);
  if (!current) return null;
  if (current.paymentMethod === paymentMethod) return current;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({ paymentMethod, updatedAt: new Date() })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    await tx.insert(appointmentChanges).values({
      appointmentId: id,
      changedBy,
      field: "payment_method",
      oldValue: current.paymentMethod ?? "",
      newValue: paymentMethod ?? "",
    });

    return updated;
  });
}

/**
 * Fija el descuento por bono de cumpleaños de la cita (COP). Lo topa entre 0 y
 * el total, recalcula el estado de pago sobre el neto (total − bono) y audita.
 */
export async function setBonusDiscount(
  tenantId: string,
  id: string,
  bonusDiscountCop: bigint,
  changedBy: string | null = null,
): Promise<Appointment | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .for("update")
      .limit(1);
    if (!current) return null;

    const capped =
      bonusDiscountCop < 0n
        ? 0n
        : bonusDiscountCop > current.totalCop
          ? current.totalCop
          : bonusDiscountCop;
    const nextPayment = derivePaymentStatus(
      current.totalCop - capped,
      current.paidCop,
    );

    const [updated] = await tx
      .update(appointments)
      .set({
        bonusDiscountCop: capped,
        paymentStatus: nextPayment,
        updatedAt: new Date(),
      })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    if (capped !== current.bonusDiscountCop) {
      await tx.insert(appointmentChanges).values({
        appointmentId: id,
        changedBy,
        field: "bonus_discount_cop",
        oldValue: String(current.bonusDiscountCop),
        newValue: String(capped),
      });
    }

    return updated;
  });
}

/**
 * Aplica el descuento del bono a la cita Y redime el bono (chosen → redeemed) en
 * UNA SOLA transacción (B2.2). Antes eran dos operaciones separadas con
 * compensación best-effort (QA B2): si el proceso moría entre ambas quedaba el
 * descuento aplicado con el bono sin consumir. Ahora es todo-o-nada: si la
 * redención no afecta ninguna fila (el bono no está 'chosen'), se lanza y la
 * transacción revierte el descuento.
 *
 * Nota de arquitectura: toca dos tablas de módulos distintos (appointments +
 * birthday_bonuses). Se coordina aquí por transaccionalidad; en B4 se moverá a un
 * evento de dominio (R-D3). Solo importa el SCHEMA de birthdays (sin ciclo de
 * código ejecutable).
 */
export async function applyBonusDiscountAndRedeem(
  tenantId: string,
  params: {
    appointmentId: string;
    bonusId: string;
    discountCop: bigint;
    changedBy?: string | null;
  },
): Promise<Appointment | null> {
  const { appointmentId, bonusId, discountCop, changedBy = null } = params;
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.id, appointmentId),
        ),
      )
      .for("update")
      .limit(1);
    if (!current) return null;

    const capped =
      discountCop < 0n
        ? 0n
        : discountCop > current.totalCop
          ? current.totalCop
          : discountCop;
    const nextPayment = derivePaymentStatus(
      current.totalCop - capped,
      current.paidCop,
    );

    // 1) Redime el bono PRIMERO (guard de estado): si no está 'chosen', 0 filas
    //    → lanzamos y se revierte todo. Evita descuento sin bono consumido.
    const redeemed = await tx
      .update(birthdayBonuses)
      .set({ status: "redeemed", appointmentId, updatedAt: new Date() })
      .where(
        and(
          eq(birthdayBonuses.tenantId, tenantId),
          eq(birthdayBonuses.id, bonusId),
          eq(birthdayBonuses.status, "chosen"),
        ),
      )
      .returning({ id: birthdayBonuses.id });
    if (redeemed.length === 0) {
      throw new Error("bonus_not_redeemable");
    }

    // 2) Aplica el descuento a la cita + auditoría.
    const [updated] = await tx
      .update(appointments)
      .set({
        bonusDiscountCop: capped,
        paymentStatus: nextPayment,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.id, appointmentId),
        ),
      )
      .returning();

    if (capped !== current.bonusDiscountCop) {
      await tx.insert(appointmentChanges).values({
        appointmentId,
        changedBy,
        field: "bonus_discount_cop",
        oldValue: String(current.bonusDiscountCop),
        newValue: String(capped),
      });
    }

    return updated;
  });
}

/** Cancela una cita (status = cancelled) con auditoría. */
export async function cancelAppointment(
  tenantId: string,
  id: string,
  changedBy: string | null = null,
): Promise<Appointment | null> {
  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1);
  if (!current) return null;
  if (current.status === "cancelled") return current;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    await tx.insert(appointmentChanges).values({
      appointmentId: id,
      changedBy,
      field: "status",
      oldValue: current.status,
      newValue: "cancelled",
    });

    return updated;
  });
}

/** Reactiva una cita cancelada (status = scheduled) con auditoría. */
export async function reactivateAppointment(
  tenantId: string,
  id: string,
  changedBy: string | null = null,
): Promise<Appointment | null> {
  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1);
  if (!current) return null;
  if (current.status !== "cancelled" && current.status !== "completed")
    return current;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning();

    await tx.insert(appointmentChanges).values({
      appointmentId: id,
      changedBy,
      field: "status",
      oldValue: current.status,
      newValue: "scheduled",
    });

    return updated;
  });
}

/** Historial de cambios de una cita (auditoría RF-02), orden ascendente. Tenant-scoped. */
export async function getAppointmentHistory(
  tenantId: string,
  appointmentId: string,
): Promise<AppointmentChange[]> {
  // Verifica propiedad del tenant antes de exponer el historial.
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.id, appointmentId),
      ),
    )
    .limit(1);
  if (!appt) return [];

  return db
    .select()
    .from(appointmentChanges)
    .where(eq(appointmentChanges.appointmentId, appointmentId))
    .orderBy(asc(appointmentChanges.changedAt));
}

/** Actualiza el estado de sincronización con Google Calendar. Tenant-scoped. */
export async function setGcalSync(
  tenantId: string,
  appointmentId: string,
  data: {
    gcalEventId?: string | null;
    gcalSyncStatus?: "ok" | "pending" | "error";
  },
): Promise<void> {
  await db
    .update(appointments)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.id, appointmentId),
      ),
    );
}

/**
 * Citas scheduled sin evento en Google Calendar,
 * para el backfill tras conectar la cuenta (F5.B2). Tenant-scoped.
 */
export async function listScheduledWithoutGcalEvent(
  tenantId: string,
  now: Date = new Date(),
): Promise<Appointment[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "scheduled"),
        isNull(appointments.gcalEventId),
        gte(appointments.startsAt, now),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

// ─── Cross-tenant queries (crons) ────────────────────────────────────────────

/**
 * Devuelve todos los tenants que tienen citas `scheduled` manana (en su TZ).
 * Se usa en el cron de recordatorio nocturno (/api/cron/reminder-tomorrow).
 *
 * Asume America/Bogota para todos los tenants (valor por defecto en la app).
 */
export async function listTenantsWithAppointmentsTomorrow(): Promise<
  { tenantId: string; timezone: string; count: number; firstStartsAt: Date }[]
> {
  // "Mañana" se evalúa en la TZ de CADA tenant (R-D4), no en una zona fija: la
  // fecha local de la cita debe ser el día siguiente a hoy en la TZ del negocio.
  // `x at time zone tz` convierte el timestamptz a la hora local de pared.
  const rows = await db
    .select({
      tenantId: appointments.tenantId,
      timezone: tenants.timezone,
      count: sql<number>`cast(count(*) as int)`,
      firstStartsAt: sql<Date>`min(${appointments.startsAt})`,
    })
    .from(appointments)
    .innerJoin(tenants, eq(appointments.tenantId, tenants.id))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        sql`(${appointments.startsAt} at time zone ${tenants.timezone})::date = ((now() at time zone ${tenants.timezone})::date + 1)`,
      ),
    )
    .groupBy(appointments.tenantId, tenants.timezone);

  return rows;
}
