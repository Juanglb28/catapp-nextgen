import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { getTenant, getUserTenant } from "@/modules/tenancy/repository";

export type TenantContext = {
  userId: string;
  tenantId: string;
};

/**
 * Lógica de resolución del contexto de tenant (sin caché, para poder testearla).
 * - Sin sesión -> redirect a /login.
 * - Con sesión pero sin tenant -> redirect a /onboarding.
 * - Con tenant -> { userId, tenantId, role }.
 */
export async function resolveTenant(): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const membership = await getUserTenant(session.user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
  };
}

/**
 * Contexto de tenant del request actual. Cacheado por request con React cache()
 * para no repetir la consulta de sesión/membership en el mismo render.
 */
export const requireTenant = cache(resolveTenant);

/**
 * Tenant completo cacheado por request (B0.3). El layout y la página del mismo
 * segmento suelen pedir el tenant por separado: sin caché eran 2 consultas
 * idénticas por navegación. Úsese en Server Components de render; las actions y
 * crons pueden seguir con `getTenant` directo (viven en requests distintos).
 */
export const getTenantCached = cache(getTenant);
