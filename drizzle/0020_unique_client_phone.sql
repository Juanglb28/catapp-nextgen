CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_phone_unique" ON "clients" ("tenant_id","phone");
