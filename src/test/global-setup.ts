import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Vitest globalSetup: prepara la base de datos de integración de forma
 * DETERMINISTA (B2.4). Si `TEST_DATABASE_URL` está definida, aplica todas las
 * migraciones contra esa base antes de correr los tests. Así ya no hace falta un
 * `pnpm db:migrate` manual (que dependía del `.env` y podía migrar la base
 * equivocada). Sin `TEST_DATABASE_URL` (corrida solo-unit) no hace nada.
 *
 * OJO: `globalSetup` corre en SU PROPIO proceso, UNA vez, ANTES de
 * `setupFiles` (`vitest.setup.ts`) — que es donde normalmente se carga
 * `TEST_DATABASE_URL` desde `.env`. Sin esta carga aquí también, este archivo
 * siempre veía `process.env.TEST_DATABASE_URL` como `undefined` y el
 * `if (!url) return` se disparaba en silencio: la migración nunca se
 * aplicaba sola (el bug que describe D-39 — se detectó porque los tests
 * fallaban con "relation ... does not exist" para una tabla recién creada
 * por una migración nueva, en una base que ya tenía las tablas viejas de
 * una migración manual anterior). Se carga igual que en `vitest.setup.ts`:
 * SOLO `TEST_DATABASE_URL`, nunca el resto de `.env` (mismo motivo: no
 * cambiar el comportamiento de otros tests que asumen secretos sin
 * configurar).
 */
export default async function setup() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const envPath = resolve(process.cwd(), ".env");
    if (existsSync(envPath)) {
      url = parse(readFileSync(envPath)).TEST_DATABASE_URL;
      if (url) process.env.TEST_DATABASE_URL = url;
    }
  }
  if (!url) return;

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
