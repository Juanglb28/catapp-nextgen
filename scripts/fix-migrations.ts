/**
 * Crea drizzle.__drizzle_migrations y registra todas las migraciones ya
 * aplicadas (0000–0019) para que `pnpm db:migrate` solo corra 0020 y 0021.
 *
 * Uso: npx tsx scripts/fix-migrations.ts
 */
import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL no está definida en .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

// Todas las migraciones ya aplicadas a la DB (0000-0019).
// `when` = valor exacto del campo `when` en _journal.json.
const applied = [
  { tag: "0000_warm_rafael_vega", when: 1781142459042 },
  { tag: "0001_acoustic_black_panther", when: 1781154254236 },
  { tag: "0002_aromatic_lady_mastermind", when: 1781199821048 },
  { tag: "0003_clients", when: 1781207318267 },
  { tag: "0004_services", when: 1781209220568 },
  { tag: "0005_appointments", when: 1781214863713 },
  { tag: "0006_tenant_public_info", when: 1781224071956 },
  { tag: "0007_message_templates", when: 1781272158131 },
  { tag: "0008_appointment_sequence", when: 1781273192715 },
  { tag: "0009_google_accounts", when: 1781279413907 },
  { tag: "0010_gcal_sync_status", when: 1781300704261 },
  { tag: "0011_inventory", when: 1781312969181 },
  { tag: "0012_wa_messages", when: 1781314953783 },
  { tag: "0013_auto_messages_opt_out", when: 1781316022676 },
  { tag: "0014_tip_cop", when: 1750550400000 },
  { tag: "0015_handy_blade", when: 1782072878280 },
  { tag: "0016_birthday_date", when: 1782346401000 },
  { tag: "0017_birthday_bonuses", when: 1782346402000 },
  { tag: "0018_birthday_gcal_event", when: 1782346403000 },
  { tag: "0019_payment_method", when: 1782408709000 },
];

try {
  await db.execute(sql`SELECT 1`);
  console.log("✅ Conectado a la DB");

  // 1. Crear schema drizzle y tabla de control (misma DDL que usa drizzle-orm).
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id        SERIAL PRIMARY KEY,
      hash      TEXT NOT NULL,
      created_at BIGINT
    )
  `);
  console.log("✅ Schema drizzle y tabla __drizzle_migrations listos");

  // 2. Ver qué registros ya existen.
  const existing = await db.execute(
    sql`SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`,
  );
  const existingMillis = new Set(
    existing.rows.map((r) => Number(r.created_at)),
  );
  console.log(`📋 Registros existentes: ${existingMillis.size}`);

  // 3. Insertar los que faltan.
  let inserted = 0;
  for (const { tag, when } of applied) {
    if (existingMillis.has(when)) {
      console.log(`⏭️  ${tag} ya registrado`);
      continue;
    }
    const filePath = `./drizzle/${tag}.sql`;
    const content = fs.readFileSync(filePath).toString();
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${when})`,
    );
    console.log(`✅ ${tag}`);
    inserted++;
  }

  console.log(
    `\n🎉 ${inserted} registros insertados. Ahora corre: pnpm db:migrate`,
  );
} catch (e) {
  console.error("❌", e);
  process.exit(1);
} finally {
  await pool.end();
}
