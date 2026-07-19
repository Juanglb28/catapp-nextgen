import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";

import { type Service, services } from "./schema";

/**
 * Repositorio de servicios — alcance de tenant obligatorio (D-11).
 * Cada función recibe `tenantId` como PRIMER parámetro y filtra por él.
 * Los servicios no se borran: se desactivan (`active=false`).
 */

export type ServiceInput = {
  name: string;
  basePriceCop: bigint;
  durationMin: number;
};

/** Servicios del tenant. Por defecto solo los activos. */
export async function listServices(
  tenantId: string,
  opts?: { includeInactive?: boolean },
): Promise<Service[]> {
  const conditions = [eq(services.tenantId, tenantId)];
  if (!opts?.includeInactive) {
    conditions.push(eq(services.active, true));
  }
  return db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(asc(services.name));
}

/** Servicios del tenant por lista de ids (para congelar precios al agendar). */
export async function listServicesByIds(
  tenantId: string,
  ids: string[],
): Promise<Service[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(services)
    .where(and(eq(services.tenantId, tenantId), inArray(services.id, ids)));
}

/** Un servicio por id, solo si pertenece al tenant. */
export async function getService(
  tenantId: string,
  id: string,
): Promise<Service | null> {
  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

/** Crea un servicio en el tenant. */
export async function createService(
  tenantId: string,
  data: ServiceInput,
): Promise<Service> {
  const [row] = await db
    .insert(services)
    .values({ tenantId, ...data })
    .returning();
  return row;
}

/** Crea varios servicios del tenant en un solo insert (seed de onboarding). */
export async function createServices(
  tenantId: string,
  items: ServiceInput[],
): Promise<Service[]> {
  if (items.length === 0) return [];
  return db
    .insert(services)
    .values(items.map((data) => ({ tenantId, ...data })))
    .returning();
}

/** Actualiza un servicio del tenant; null si no existe / es de otro tenant. */
export async function updateService(
  tenantId: string,
  id: string,
  data: ServiceInput,
): Promise<Service | null> {
  const [row] = await db
    .update(services)
    .set(data)
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .returning();
  return row ?? null;
}

/** Desactiva un servicio del tenant (no se borra). */
export async function deactivateService(
  tenantId: string,
  id: string,
): Promise<Service | null> {
  const [row] = await db
    .update(services)
    .set({ active: false })
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .returning();
  return row ?? null;
}

/** Reactiva un servicio del tenant. */
export async function activateService(
  tenantId: string,
  id: string,
): Promise<Service | null> {
  const [row] = await db
    .update(services)
    .set({ active: true })
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .returning();
  return row ?? null;
}
