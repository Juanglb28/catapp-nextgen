/**
 * Patrón de repositorios de CatApp — aislamiento multi-tenant.
 *
 * REGLA PERMANENTE: toda función de repositorio de un módulo de negocio recibe
 * `tenantId` como PRIMER parámetro y filtra TODAS sus queries por ese tenant.
 * El acceso directo a `@/lib/db` está prohibido fuera de los `repository.ts`
 * (regla ESLint `no-restricted-imports`), de modo que exponer datos de otro
 * tenant exige violar la regla a propósito.
 *
 * Excepción: la consulta de "bootstrap" que resuelve a qué tenant pertenece un
 * usuario (`getUserTenant` en tenancy/repository.ts) no recibe `tenantId`,
 * porque justamente lo está estableciendo.
 *
 * Ejemplo:
 *   export async function listClients(tenantId: string, opts?: {...}) {
 *     return db.select().from(clients).where(eq(clients.tenantId, tenantId));
 *   }
 */

export type TenantId = string;

/** Forma de toda función de repositorio con alcance de tenant. */
export type TenantScopedRepo<Args extends unknown[], Result> = (
  tenantId: TenantId,
  ...args: Args
) => Promise<Result>;
