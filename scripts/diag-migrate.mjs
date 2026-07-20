// Diagnóstico NO destructivo de la migración (B1, 2026-07-19).
// Uso: node scripts/diag-migrate.mjs
// - Verifica la conexión y a qué host/DB apunta DATABASE_URL (sin exponer la
//   contraseña).
// - Lista las migraciones ya aplicadas (tabla __drizzle_migrations).
// - Ejecuta el SQL de la última migración dentro de BEGIN … ROLLBACK: imprime
//   el error EXACTO de Postgres si falla, sin cambiar nada en la base.
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL vacío. Revisa el .env.");
  process.exit(1);
}
try {
  const u = new URL(url);
  console.log(`DB objetivo: host=${u.hostname} port=${u.port} db=${u.pathname.slice(1)} user=${u.username}`);
} catch {
  console.log("DATABASE_URL no parece una URL válida.");
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8000 });

try {
  const v = await pool.query("select version()");
  console.log("Conexión OK:", v.rows[0].version.split(",")[0]);
} catch (e) {
  console.error("FALLO DE CONEXIÓN:", e.message);
  await pool.end();
  process.exit(1);
}

try {
  const m = await pool.query(
    `select id, hash, to_timestamp(created_at/1000) as at
       from drizzle.__drizzle_migrations order by id desc limit 5`,
  );
  console.log(`Migraciones aplicadas (últimas ${m.rowCount}):`);
  for (const r of m.rows) console.log("  ", r.id, r.at);
} catch (e) {
  console.log("No pude leer drizzle.__drizzle_migrations:", e.message);
}

// Última migración por nombre de archivo.
const dir = "./drizzle";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const last = files[files.length - 1];
console.log(`\nProbando (dry-run, con ROLLBACK): ${last}`);
const sql = readFileSync(`${dir}/${last}`, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const stmt of sql) {
    try {
      await client.query(stmt);
    } catch (e) {
      console.error("\n❌ FALLA ESTA SENTENCIA:\n", stmt.slice(0, 300));
      console.error("\nError Postgres:", e.message);
      if (e.hint) console.error("Hint:", e.hint);
      throw e;
    }
  }
  console.log("\n✅ Todas las sentencias corrieron OK (dry-run).");
} catch {
  // el error ya se imprimió
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
  console.log("(Rollback hecho: la base no se modificó.)");
}
