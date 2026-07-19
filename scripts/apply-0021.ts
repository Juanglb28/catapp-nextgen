import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString: url });

try {
  const client = await pool.connect();

  // Verificar si el tipo ya existe
  const typeCheck = await client.query(
    `SELECT typname FROM pg_type WHERE typname = 'client_confirmation_status'`,
  );

  if (typeCheck.rows.length === 0) {
    console.log("Creando tipo client_confirmation_status...");
    await client.query(`
      CREATE TYPE "public"."client_confirmation_status" AS ENUM('pending', 'accepted', 'rejected')
    `);
    console.log("✅ Tipo creado");
  } else {
    console.log("⏭️  Tipo ya existe");
  }

  // Verificar si la columna ya existe
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'client_confirmation'
  `);

  if (colCheck.rows.length === 0) {
    console.log("Agregando columnas a appointments...");
    await client.query(`
      ALTER TABLE "appointments"
        ADD COLUMN "client_confirmation" "client_confirmation_status" NOT NULL DEFAULT 'pending',
        ADD COLUMN "client_rejection_note" text
    `);
    console.log("✅ Columnas agregadas");
  } else {
    console.log("⏭️  Columnas ya existen");
  }

  // Registrar la migración en drizzle
  const { createHash } = await import("crypto");
  const { readFileSync } = await import("fs");
  const sql = readFileSync("./drizzle/0021_client_confirmation.sql").toString();
  const hash = createHash("sha256").update(sql).digest("hex");
  const when = 1782750000000;

  const migCheck = await client.query(
    `SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = $1`,
    [when],
  );
  if (migCheck.rows.length === 0) {
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, when],
    );
    console.log("✅ Migración registrada en drizzle.__drizzle_migrations");
  } else {
    console.log("⏭️  Migración ya registrada");
  }

  client.release();
  console.log(
    "\n🎉 Listo — la columna client_confirmation ya existe en producción",
  );
} finally {
  await pool.end();
}
