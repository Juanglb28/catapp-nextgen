import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  memberships,
  type MemberRole,
  type Tenant,
  tenants,
} from "@/modules/tenancy/schema";

/** Actualiza los datos públicos del negocio (F4.B1). */
export async function updateTenantPublicInfo(
  tenantId: string,
  data: { publicAddress: string | null; publicNote: string | null },
): Promise<void> {
  await db.update(tenants).set(data).where(eq(tenants.id, tenantId));
}

/** Activa/desactiva los mensajes automáticos de WhatsApp del tenant (F8.B2). */
export async function updateBonusValues(
  tenantId: string,
  data: { bonusManicureCop: bigint; bonusVeloterapiaCop: bigint },
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
): Promise<{ tenantId: string; role: MemberRole } | null> {
  const rows = await db
    .select({ tenantId: memberships.tenantId, role: memberships.role })
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
      role: "owner",
    });

    return { tenantId: tenant.id };
  });
}
