import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { getUserTenant } from "@/modules/tenancy/repository";
import { type MemberRole } from "@/modules/tenancy/schema";

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: MemberRole;
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
    role: membership.role,
  };
}

/**
 * Contexto de tenant del request actual. Cacheado por request con React cache()
 * para no repetir la consulta de sesión/membership en el mismo render.
 */
export const requireTenant = cache(resolveTenant);
