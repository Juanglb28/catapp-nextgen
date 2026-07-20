import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Vitest globalSetup: prepara la base de datos de integración de forma
 * DETERMINISTA (B2.4). Si `TEST_DATABASE_URL` está definida, aplica todas las
 * migraciones contra esa base antes de correr los tests. Así ya no hace falta un
 * `pnpm db:migrate` manual (que dependía del `.env` y podía migrar la base
 * equivocada). Sin `TEST_DATABASE_URL` (corrida solo-unit) no hace nada.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
