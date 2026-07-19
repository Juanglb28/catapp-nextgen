import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UNLOCK_COOKIE, isUnlockValid } from "@/lib/app-lock";
import { requireTenant } from "@/modules/tenancy/context";

import { isLockEnabled } from "./repository";

/**
 * Exige que la app esté desbloqueada para ver la sección. Si el bloqueo está
 * activo y no hay desbloqueo válido, redirige a /desbloquear con `next`.
 * Se llama desde los layouts de Finanzas y Ajustes (Server Components).
 */
export async function requireUnlocked(pathname: string): Promise<void> {
  const { userId } = await requireTenant();
  if (!(await isLockEnabled(userId))) return;

  const token = (await cookies()).get(UNLOCK_COOKIE)?.value;
  if (isUnlockValid(token, userId)) return;

  redirect(`/desbloquear?next=${encodeURIComponent(pathname)}`);
}
