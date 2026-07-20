import { randomUUID } from "node:crypto";

/**
 * Arnés de tests de integración con DB real (F1.B4).
 *
 * Los tests de integración requieren una base de datos de test con las
 * migraciones aplicadas, indicada en `TEST_DATABASE_URL`. Sin esa variable
 * (CI/sandbox) los tests que la usan se saltan vía `describe.runIf(TEST_DB)`.
 *
 * Para correrlos en local usa una base DESECHABLE (el harness hace TRUNCATE
 * CASCADE entre tests: NUNCA apuntes TEST_DATABASE_URL a tu base de desarrollo).
 * Y córrelos EN SERIE con `pnpm test:integration` (--no-file-parallelism): todos
 * los archivos comparten la misma base y hacen TRUNCATE, así que en paralelo se
 * pisan y dan deadlocks/violaciones de FK. Ejemplo (PowerShell):
 *   docker exec catapp-db psql -U catapp -c "CREATE DATABASE catapp_test;"
 *   $env:DATABASE_URL="postgresql://catapp:catapp@127.0.0.1:5433/catapp_test"
 *   pnpm db:migrate
 *   $env:TEST_DATABASE_URL="postgresql://catapp:catapp@127.0.0.1:5433/catapp_test"
 *   pnpm test:integration
 *
 * El cliente de DB se importa de forma diferida (dynamic import) DESPUÉS de
 * apuntar `DATABASE_URL` al test, igual que el resto de tests de integración;
 * así `@/lib/db` no aparece como import estático fuera de un repositorio.
 */

export const TEST_DB = process.env.TEST_DATABASE_URL;

/** Importa el cliente de DB apuntando primero a la base de datos de test. */
async function loadDb() {
  process.env.DATABASE_URL = TEST_DB;
  return import("@/lib/db");
}

export { loadDb };

/** Crea un usuario (tabla Better Auth) y devuelve la fila insertada. */
export async function seedUser(overrides?: {
  name?: string;
  email?: string;
}): Promise<{ id: string; email: string }> {
  const { db } = await loadDb();
  const { user } = await import("@/modules/tenancy/auth-schema");
  const id = randomUUID();
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: overrides?.name ?? "Usuaria de prueba",
      email: overrides?.email ?? `u-${id}@test.local`,
    })
    .returning({ id: user.id, email: user.email });
  return row;
}

/**
 * Crea un negocio (tenant) con su membership owner para `userId`, usando el
 * MISMO código de producción (`createTenantWithOwner`). Devuelve el tenantId.
 */
export async function seedTenantWithOwner(
  userId: string,
  name = "Negocio de prueba",
): Promise<string> {
  const { createTenantWithOwner } =
    await import("@/modules/tenancy/repository");
  const { tenantId } = await createTenantWithOwner(userId, {
    name,
    phone: "+573001234567",
    timezone: "America/Bogota",
  });
  return tenantId;
}

/** Vacía las tablas de negocio y de auth entre tests (orden seguro por FKs). */
export async function resetDb(): Promise<void> {
  const { db } = await loadDb();
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql`TRUNCATE TABLE memberships, tenants RESTART IDENTITY CASCADE`,
  );
  await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
}

/** Cierra el pool de conexiones (llamar en afterAll de cada archivo). */
export async function closeDb(): Promise<void> {
  const { pool } = await loadDb();
  await pool.end();
}
