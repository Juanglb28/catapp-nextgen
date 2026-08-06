import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/modules/tenancy/auth-schema";
import { memberships, type Tenant, tenants } from "@/modules/tenancy/schema";

/** Actualiza los datos públicos del negocio (F4.B1). */
export async function updateTenantPublicInfo(
  tenantId: string,
  data: { publicAddress: string | null; publicNote: string | null },
): Promise<void> {
  await db.update(tenants).set(data).where(eq(tenants.id, tenantId));
}

export async function setAutoMessages(
  tenantId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(tenants)
    .set({ autoMessages: enabled })
    .where(eq(tenants.id, tenantId));
}

/** Ping de infraestructura para el healthcheck. No tiene alcance de tenant. */
export async function ping(): Promise<void> {
  await db.execute(sql`select 1`);
}

/**
 * Consulta de bootstrap: resuelve a qué tenant pertenece un usuario.
 * Excepción al patrón "tenantId primero": aquí justamente se ESTABLECE el tenant.
 */
export async function getUserTenant(
  userId: string,
): Promise<{ tenantId: string } | null> {
  const rows = await db
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Tenant por id. */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Crea el negocio y la membresía owner en UNA transacción.
 * Si falla la membresía, no queda tenant huérfano (rollback).
 * Excepción al patrón "tenantId primero": crea el tenant.
 */
export async function createTenantWithOwner(
  userId: string,
  data: { name: string; phone: string; timezone: string },
): Promise<{ tenantId: string }> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: data.name, phone: data.phone, timezone: data.timezone })
      .returning({ id: tenants.id });

    await tx.insert(memberships).values({
      userId,
      tenantId: tenant.id,
    });

    return { tenantId: tenant.id };
  });
}

/**
 * Borra cuentas que nunca confirmaron su correo y ya vencieron (cron de
 * limpieza, ver `docs/CRONS.md`). Seguro: el tenant/membership recién se crea
 * en el onboarding, que exige sesión (= correo verificado) — una cuenta sin
 * verificar nunca tiene tenant propio, así que no deja nada huérfano. Las
 * filas de `session`/`account` de ese usuario caen solas por `onDelete:
 * cascade`. Evita que un correo quede "reservado" para siempre por una cuenta
 * abandonada (typo, bot, o alguien que nunca volvió a hacer clic en el enlace).
 */
export async function deleteStaleUnverifiedUsers(
  olderThan: Date,
): Promise<number> {
  const deleted = await db
    .delete(user)
    .where(and(eq(user.emailVerified, false), lt(user.createdAt, olderThan)))
    .returning({ id: user.id });
  return deleted.length;
}
