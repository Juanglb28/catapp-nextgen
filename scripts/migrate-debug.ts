/**
 * Script de diagnóstico: corre las migraciones Drizzle con errores visibles.
 * Uso: npx tsx scripts/migrate-debug.ts
 */
import "dotenv/config";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL no está definida en .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

console.log("🔌 Conectando a la base de datos…");
try {
  await db.execute(sql`SELECT 1`);
  console.log("✅ Conexión OK");
} catch (e) {
  console.error("❌ No se pudo conectar:", e);
  process.exit(1);
}

console.log("🚀 Aplicando migraciones…");
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migraciones aplicadas correctamente");
} catch (e) {
  console.error("❌ Error al migrar:");
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
