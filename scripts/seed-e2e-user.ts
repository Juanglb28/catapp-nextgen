/**
 * Crea el usuario E2E + tenant + clienta + servicio de prueba en la DB.
 * Llama a Better Auth directamente (sin HTTP) para crear el usuario,
 * luego inserta el tenant, membresía, clienta y servicio vía repositorios.
 *
 * Uso: node --import tsx/esm scripts/seed-e2e-user.ts
 * Variables requeridas: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
 *                       E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 */

import "dotenv/config";
import { auth } from "../src/lib/auth";
import {
  createTenantWithOwner,
  getUserTenant,
} from "../src/modules/tenancy/repository";
import { listClients, createClient } from "../src/modules/clients/repository";
import {
  listServices,
  createService,
} from "../src/modules/services/repository";
import { db, pool } from "../src/lib/db";
import { eq } from "drizzle-orm";
import { user as userTable } from "../src/modules/tenancy/auth-schema";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email || !password) {
  console.log("ℹ️  Faltan E2E_TEST_EMAIL y/o E2E_TEST_PASSWORD. Seed omitido.");
  process.exit(0);
}

// ── 1. Crear usuario via Better Auth ──────────────────────────────────────────
const fakeHeaders = new Headers({ "content-type": "application/json" });

const signUpResp = await auth.api.signUpEmail({
  body: { email, password, name: "Usuario E2E" },
  headers: fakeHeaders,
  asResponse: true,
});

if (signUpResp.status === 200 || signUpResp.status === 201) {
  console.log(`✅ Usuario E2E creado: ${email}`);
} else if (
  signUpResp.status === 422 ||
  signUpResp.status === 409 ||
  signUpResp.status === 400
) {
  console.log(`ℹ️  Usuario E2E ya existe (${signUpResp.status})`);
} else {
  const body = await signUpResp.text().catch(() => "(sin cuerpo)");
  console.error(`❌ Error al crear usuario (${signUpResp.status}): ${body}`);
  await pool.end();
  process.exit(1);
}

// ── 2. Obtener el userId desde la DB ──────────────────────────────────────────
const rows = await db
  .select({ id: userTable.id })
  .from(userTable)
  .where(eq(userTable.email, email))
  .limit(1);

const userId = rows[0]?.id;
if (!userId) {
  console.error("❌ No se encontró el usuario en la DB tras el sign-up.");
  await pool.end();
  process.exit(1);
}

// ── 3. Crear tenant + membresía si no existe ──────────────────────────────────
let tenantId: string;
const existing = await getUserTenant(userId);
if (existing) {
  tenantId = existing.tenantId;
  console.log(`ℹ️  Tenant E2E ya existe (tenantId: ${tenantId})`);
} else {
  const result = await createTenantWithOwner(userId, {
    name: "Negocio E2E",
    phone: "+573001234567",
    timezone: "America/Bogota",
  });
  tenantId = result.tenantId;
  console.log(`✅ Tenant E2E creado: ${tenantId}`);
}

// ── 4. Crear clienta de prueba si no existe ninguna ──────────────────────────
const clientasExistentes = await listClients(tenantId);
if (clientasExistentes.length === 0) {
  await createClient(tenantId, {
    name: "Clienta E2E",
    phone: "+573009876543",
    email: null,
    notes: null,
  });
  console.log("✅ Clienta E2E creada.");
} else {
  console.log(
    `ℹ️  Ya existen ${clientasExistentes.length} clienta(s) — no se crea otra.`,
  );
}

// ── 5. Crear servicio de prueba si no existe ninguno ─────────────────────────
const serviciosExistentes = await listServices(tenantId);
if (serviciosExistentes.length === 0) {
  await createService(tenantId, {
    name: "Manicure E2E",
    basePriceCop: 50000n,
    durationMin: 60,
  });
  console.log("✅ Servicio E2E creado.");
} else {
  console.log(
    `ℹ️  Ya existen ${serviciosExistentes.length} servicio(s) — no se crea otro.`,
  );
}

// ── 6. Cerrar pool limpiamente ─────────────────────────────────────────────────
await pool.end();
console.log("✅ Seed E2E completado.");
