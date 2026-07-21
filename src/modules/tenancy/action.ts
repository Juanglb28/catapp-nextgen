import type { ActionResult } from "@/lib/action-result";

import { requireTenant, type TenantContext } from "./context";

/**
 * Envuelve una Server Action con la resolución de tenant (B4/R-C2). Deduplica el
 * `const { tenantId } = await requireTenant()` de cada acción y da un único punto
 * de entrada consistente. `requireTenant` sigue redirigiendo a /login o
 * /onboarding cuando corresponde (el throw de redirect se propaga), y los errores
 * de dominio siguen manejándose dentro de `fn` como hasta ahora — este helper no
 * traga excepciones, así que no cambia la semántica existente.
 *
 * Uso:
 *   export async function createServiceAction(input: unknown) {
 *     return withTenantAction(({ tenantId }) => createServiceImpl(tenantId, input));
 *   }
 */
export function withTenantAction<T>(
  fn: (ctx: TenantContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return requireTenant().then(fn);
}
