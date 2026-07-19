import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export type SessionUser = { id: string; email: string; name: string };

/** Usuario de la sesión actual, o null si no hay sesión. Para route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
