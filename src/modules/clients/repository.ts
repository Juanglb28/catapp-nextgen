import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { appointments } from "@/modules/appointments/schema";

import { type Client, clients } from "./schema";

/**
 * Repositorio de clientas — alcance de tenant obligatorio (D-11).
 * Cada función recibe `tenantId` como PRIMER parámetro y filtra TODAS sus
 * queries por él; es imposible leer o mutar la clienta de otro tenant.
 */

export type ClientInput = {
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  /** Fecha de cumpleaños "YYYY-MM-DD" o null */
  birthdayDate?: string | null;
};

/** Clientas activas (no archivadas), opcionalmente filtradas por búsqueda. */
export async function listClients(
  tenantId: string,
  opts?: { search?: string },
): Promise<Client[]> {
  const conditions = [
    eq(clients.tenantId, tenantId),
    isNull(clients.archivedAt),
  ];

  const search = opts?.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const match = or(ilike(clients.name, like), ilike(clients.phone, like));
    if (match) conditions.push(match);
  }

  return db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(asc(clients.name));
}

/** Clientas archivadas (borrado lógico). */
export async function listArchivedClients(tenantId: string): Promise<Client[]> {
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), isNotNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
}

/** Una clienta por id, solo si pertenece al tenant. */
export async function getClient(
  tenantId: string,
  id: string,
): Promise<Client | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

/** Crea una clienta en el tenant. */
export async function createClient(
  tenantId: string,
  data: ClientInput,
): Promise<Client> {
  const [row] = await db
    .insert(clients)
    .values({ tenantId, ...data })
    .returning();
  return row;
}

/**
 * Actualiza una clienta del tenant. Devuelve la fila actualizada o null si no
 * existe / pertenece a otro tenant (el WHERE por tenant_id evita cruzar datos).
 */
export async function updateClient(
  tenantId: string,
  id: string,
  data: ClientInput,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set(data)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

/** Guarda el id del evento de cumpleaños en Google Calendar para la clienta. */
export async function setClientBirthdayGcalEventId(
  tenantId: string,
  id: string,
  gcalEventId: string,
): Promise<void> {
  await db
    .update(clients)
    .set({ birthdayGcalEventId: gcalEventId })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)));
}

/** Archiva (borrado lógico) una clienta del tenant. */
/** Activa/desactiva el opt-out de mensajes automáticos de la clienta (F8.B2). */
export async function setClientOptOut(
  tenantId: string,
  id: string,
  optOut: boolean,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ waOptOut: optOut })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

export async function archiveClient(
  tenantId: string,
  id: string,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(clients.tenantId, tenantId),
        eq(clients.id, id),
        isNull(clients.archivedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Elimina permanentemente una clienta del tenant.
 * Solo funciona si no tiene citas asociadas (la FK sin onDelete=cascade lo garantiza).
 * Devuelve true si se eliminó, false si no existía o pertenece a otro tenant.
 */
export async function deleteClient(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)));
  return (result.rowCount ?? 0) > 0;
}

/** Restaura una clienta archivada del tenant. */
export async function restoreClient(
  tenantId: string,
  id: string,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ archivedAt: null })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Actualiza solo el campo birthday_date de una clienta.
 * Usado por el sync de cumpleaños desde Google Contacts.
 */
export async function updateClientBirthday(
  tenantId: string,
  id: string,
  birthdayDate: string,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ birthdayDate })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Clientas activas sin birthday_date registrado.
 * Usadas para el match con Google Contacts durante el sync de cumpleaños.
 * Devuelve solo id, phone y name para minimizar el payload.
 */
export async function listClientsWithoutBirthday(
  tenantId: string,
): Promise<{ id: string; phone: string; name: string }[]> {
  return db
    .select({ id: clients.id, phone: clients.phone, name: clients.name })
    .from(clients)
    .where(
      and(
        eq(clients.tenantId, tenantId),
        isNull(clients.archivedAt),
        isNull(clients.birthdayDate),
      ),
    );
}

export type DuplicateClientGroup = {
  phone: string;
  clients: (Client & { appointmentCount: number })[];
};

/**
 * Grupos de clientas activas que comparten el mismo teléfono dentro del tenant.
 * Incluye el conteo de citas de cada una para ayudar a decidir cuál conservar.
 */
export async function findDuplicateClientGroups(
  tenantId: string,
): Promise<DuplicateClientGroup[]> {
  // Teléfonos con más de una clienta activa.
  const dupePhones = await db
    .select({ phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), isNull(clients.archivedAt)))
    .groupBy(clients.phone)
    .having(sql`count(*) > 1`);

  if (dupePhones.length === 0) return [];

  const phones = dupePhones.map((r) => r.phone);

  // Todas las clientas activas con esos teléfonos + conteo de citas.
  const rows = await db
    .select({
      client: clients,
      appointmentCount: count(appointments.id),
    })
    .from(clients)
    .leftJoin(appointments, eq(appointments.clientId, clients.id))
    .where(
      and(
        eq(clients.tenantId, tenantId),
        isNull(clients.archivedAt),
        inArray(clients.phone, phones),
      ),
    )
    .groupBy(clients.id)
    .orderBy(asc(clients.phone), asc(clients.createdAt));

  // Agrupar por teléfono.
  const map = new Map<string, (Client & { appointmentCount: number })[]>();
  for (const row of rows) {
    const list = map.get(row.client.phone) ?? [];
    list.push({ ...row.client, appointmentCount: row.appointmentCount });
    map.set(row.client.phone, list);
  }

  return phones.map((phone) => ({
    phone,
    clients: map.get(phone) ?? [],
  }));
}
