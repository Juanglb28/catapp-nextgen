import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { tenantDayKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients } from "@/modules/clients/schema";
import { tenants } from "@/modules/tenancy/schema";

import {
  type BirthdayBonus,
  type BonusOption,
  birthdayBonuses,
  bonusOptions,
} from "./schema";

// ─── Opciones de bono por tenant (D-19, B1.1) ────────────────────────────────

/** Opciones de bono del tenant. `activeOnly` para la elección pública. */
export async function listBonusOptions(
  tenantId: string,
  opts?: { activeOnly?: boolean },
): Promise<BonusOption[]> {
  const where = opts?.activeOnly
    ? and(eq(bonusOptions.tenantId, tenantId), eq(bonusOptions.active, true))
    : eq(bonusOptions.tenantId, tenantId);
  return db
    .select()
    .from(bonusOptions)
    .where(where)
    .orderBy(desc(bonusOptions.active), desc(bonusOptions.createdAt));
}

/** Opción por id, tenant-scoped. */
export async function getBonusOption(
  tenantId: string,
  optionId: string,
): Promise<BonusOption | null> {
  const rows = await db
    .select()
    .from(bonusOptions)
    .where(and(eq(bonusOptions.tenantId, tenantId), eq(bonusOptions.id, optionId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBonusOption(
  tenantId: string,
  data: { label: string; discountCop: bigint },
): Promise<BonusOption> {
  const [row] = await db
    .insert(bonusOptions)
    .values({ tenantId, label: data.label, discountCop: data.discountCop })
    .returning();
  return row!;
}

export async function updateBonusOption(
  tenantId: string,
  optionId: string,
  data: { label?: string; discountCop?: bigint; active?: boolean },
): Promise<BonusOption | null> {
  const [row] = await db
    .update(bonusOptions)
    .set(data)
    .where(and(eq(bonusOptions.tenantId, tenantId), eq(bonusOptions.id, optionId)))
    .returning();
  return row ?? null;
}

/**
 * Repositorio de bonos de cumpleaños — alcance de tenant obligatorio (D-11).
 */

/** Todos los bonos pendientes de aprobación del tenant. */
export async function listPendingBonuses(
  tenantId: string,
): Promise<(BirthdayBonus & { clientName: string; clientPhone: string })[]> {
  const rows = await db
    .select({
      bonus: birthdayBonuses,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(birthdayBonuses)
    .innerJoin(clients, eq(birthdayBonuses.clientId, clients.id))
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        inArray(birthdayBonuses.status, [
          "pending_manicurist",
          "approved",
          "chosen",
        ]),
      ),
    )
    .orderBy(desc(birthdayBonuses.createdAt));

  return rows.map((r) => ({
    ...r.bonus,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
  }));
}

/** Bono activo (no completado ni rechazado) de una clienta para el año en curso. */
export async function getActiveBonusForClient(
  tenantId: string,
  clientId: string,
  tz: string = "America/Bogota",
): Promise<BirthdayBonus | null> {
  // Año en la TZ del tenant (D-05): en UTC, la noche del 31-dic ya es el año
  // siguiente y no encontraría el bono del año en curso (QA B3).
  const year = Number(tenantDayKey(new Date(), tz).slice(0, 4));
  const rows = await db
    .select()
    .from(birthdayBonuses)
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.clientId, clientId),
        eq(birthdayBonuses.year, year),
        ne(birthdayBonuses.status, "declined"),
        ne(birthdayBonuses.status, "redeemed"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Bono por su public_token (pantalla de la clienta, sin tenant check). */
export async function getBonusByToken(
  token: string,
): Promise<(BirthdayBonus & { clientName: string }) | null> {
  const rows = await db
    .select({
      bonus: birthdayBonuses,
      clientName: clients.name,
    })
    .from(birthdayBonuses)
    .innerJoin(clients, eq(birthdayBonuses.clientId, clients.id))
    .where(eq(birthdayBonuses.publicToken, token))
    .limit(1);

  if (!rows[0]) return null;
  return {
    ...rows[0].bonus,
    clientName: rows[0].clientName,
  };
}

/**
 * Bono enlazado a una cita concreta (p. ej. ya redimido en ella).
 * Se usa en el detalle de la cita para seguir mostrando el bono redimido,
 * ya que `getActiveBonusForClient` excluye los 'redeemed'.
 */
export async function getBonusForAppointment(
  tenantId: string,
  appointmentId: string,
): Promise<BirthdayBonus | null> {
  const rows = await db
    .select()
    .from(birthdayBonuses)
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.appointmentId, appointmentId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Crea un bono si no existe ya para esa clienta/año (idempotente). */
export async function upsertBirthdayBonus(
  tenantId: string,
  clientId: string,
  year: number,
): Promise<BirthdayBonus> {
  const [row] = await db
    .insert(birthdayBonuses)
    .values({ tenantId, clientId, year })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  // Ya existía — lo devolvemos.
  const existing = await db
    .select()
    .from(birthdayBonuses)
    .where(
      and(
        eq(birthdayBonuses.clientId, clientId),
        eq(birthdayBonuses.year, year),
      ),
    )
    .limit(1);
  return existing[0]!;
}

/** Manicurista aprueba el bono → status 'approved'. */
export async function approveBirthdayBonus(
  tenantId: string,
  bonusId: string,
): Promise<BirthdayBonus | null> {
  const [row] = await db
    .update(birthdayBonuses)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.id, bonusId),
        eq(birthdayBonuses.status, "pending_manicurist"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Manicurista rechaza el bono → status 'declined'. */
export async function declineBirthdayBonus(
  tenantId: string,
  bonusId: string,
): Promise<BirthdayBonus | null> {
  const [row] = await db
    .update(birthdayBonuses)
    .set({ status: "declined", updatedAt: new Date() })
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.id, bonusId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Clienta elige su opción → status 'chosen'. Guarda el id de la opción y una
 * copia de su etiqueta (snapshot para mostrarla aunque la opción se borre luego).
 */
export async function chooseBirthdayOption(
  bonusId: string,
  option: { id: string; label: string },
): Promise<BirthdayBonus | null> {
  const [row] = await db
    .update(birthdayBonuses)
    .set({
      status: "chosen",
      chosenOptionId: option.id,
      chosenOption: option.label,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(birthdayBonuses.id, bonusId),
        eq(birthdayBonuses.status, "approved"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Bono redimido en una cita → status 'redeemed'. */
export async function redeemBirthdayBonus(
  tenantId: string,
  bonusId: string,
  appointmentId: string,
): Promise<BirthdayBonus | null> {
  const [row] = await db
    .update(birthdayBonuses)
    .set({ status: "redeemed", appointmentId, updatedAt: new Date() })
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.id, bonusId),
        eq(birthdayBonuses.status, "chosen"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Número de bonos en estado pending_manicurist del tenant (para badge en nav). */
export async function pendingBirthdayBonusCount(
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(birthdayBonuses)
    .where(
      and(
        eq(birthdayBonuses.tenantId, tenantId),
        eq(birthdayBonuses.status, "pending_manicurist"),
      ),
    );
  return rows[0]?.n ?? 0;
}

/**
 * Clientes con cumpleaños hoy (día y mes coinciden).
 * Usado por el cron de cumpleaños.
 */
export async function listClientsBirthdayToday(): Promise<
  {
    tenantId: string;
    clientId: string;
    clientName: string;
    phone: string;
    /** Año en curso en la TZ del tenant (para crear el bono del año correcto). */
    year: number;
  }[]
> {
  // "Hoy" se evalúa en la TZ de CADA tenant (R-D4), no en una zona fija: `now()`
  // se convierte a la hora local del negocio y se compara mes/día/año contra el
  // cumpleaños. A las 9 PM en Bogotá ya es otro día en UTC — y otros husos difieren.
  const localNow = sql`(now() at time zone ${tenants.timezone})`;
  const rows = await db
    .select({
      tenantId: clients.tenantId,
      clientId: clients.id,
      clientName: clients.name,
      phone: clients.phone,
      year: sql<number>`cast(extract(year from ${localNow}) as int)`,
    })
    .from(clients)
    .innerJoin(tenants, eq(tenants.id, clients.tenantId))
    .where(
      and(
        isNull(clients.archivedAt),
        sql`extract(month from ${clients.birthdayDate}) = extract(month from ${localNow})`,
        sql`extract(day from ${clients.birthdayDate}) = extract(day from ${localNow})`,
      ),
    );

  return rows;
}

// Las funciones de suscripciones push se movieron a `@/modules/push/repository`
// (B4/R-C3): el push no es un concern de cumpleaños.
