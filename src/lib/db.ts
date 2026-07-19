import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as authSchema from "@/modules/tenancy/auth-schema";
import * as tenancySchema from "@/modules/tenancy/schema";

export const schema = { ...tenancySchema, ...authSchema };

// Reuse the pool across HMR reloads in development to avoid exhausting connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
