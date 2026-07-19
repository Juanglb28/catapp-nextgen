import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as authSchema from "@/modules/tenancy/auth-schema";
import * as tenancySchema from "@/modules/tenancy/schema";

export const schema = { ...tenancySchema, ...authSchema };

// Reuse the pool across HMR reloads in development to avoid exhausting connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

// Pool explícito (B0.4). Antes usaba defaults de pg (max 10 sin timeouts): con
// ~10 queries concurrentes por request en /finanzas, 2 usuarios simultáneos
// saturaban el pool. `statement_timeout` evita queries colgadas que retengan una
// conexión indefinidamente. Ajustar `max` al límite del plan de Postgres (Railway
// suele permitir ~100); si se escala a >1 réplica, repartir el presupuesto.
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 20),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
