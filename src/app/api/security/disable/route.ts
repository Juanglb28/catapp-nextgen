import { headers } from "next/headers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { UNLOCK_COOKIE } from "@/lib/app-lock";
import { consumeRateLimit } from "@/modules/rate-limit/repository";
import {
  deleteCredentials,
  setLockEnabled,
} from "@/modules/security/repository";
import { getSessionUser } from "@/modules/security/session";

export const dynamic = "force-dynamic";

/** Desactiva el bloqueo verificando la contraseña; borra las credenciales. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // Anti-fuerza-bruta (B3.1/RG-3): 5 intentos/min por usuario. Comparte cubeta
  // con unlock-password para que no se pueda alternar entre ambos endpoints.
  const { allowed, retryAfterSec } = await consumeRateLimit(
    `applock:${user.id}`,
    { limit: 5, windowMs: 60_000 },
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const { password } = (await request.json()) as { password?: unknown };
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await auth.api.signInEmail({
      body: { email: user.email, password },
      headers: await headers(),
    });
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  await deleteCredentials(user.id);
  await setLockEnabled(user.id, false);
  (await cookies()).delete(UNLOCK_COOKIE);
  return NextResponse.json({ ok: true });
}
