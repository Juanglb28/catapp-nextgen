// Diagnóstico de estado de la DB para la migración 0028 (split de pago).
// Uso: node scripts/diag-db.mjs
// No modifica nada; solo lee el estado y lo imprime.
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No hay DATABASE_URL en el entorno (.env).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  const version = await client.query("show server_version");
  console.log("Postgres:", version.rows[0].server_version);

  const cols = await client.query(
    `select column_name
       from information_schema.columns
      where table_name = 'appointments'
        and column_name in ('cash_cop', 'transfer_cop')
      order by column_name`,
  );
  console.log(
    "Columnas presentes en appointments:",
    cols.rows.map((r) => r.column_name),
  );

  const en = await client.query(
    `select e.enumlabel
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
      where t.typname = 'payment_method'
      order by e.enumsortorder`,
  );
  console.log(
    "Valores del enum payment_method:",
    en.rows.map((r) => r.enumlabel),
  );

  try {
    const mig = await client.query(
      `select hash, to_timestamp(created_at / 1000) as applied_at
         from drizzle."__drizzle_migrations"
        order by created_at desc
        limit 6`,
    );
    console.log("Últimas migraciones registradas:", mig.rows.length);
    for (const r of mig.rows) console.log("  -", r.applied_at, r.hash);
  } catch (e) {
    console.log("No pude leer drizzle.__drizzle_migrations:", e.message);
  }
} catch (e) {
  console.error("Error conectando/consultando:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
