import { headers } from "next/headers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { UNLOCK_COOKIE } from "@/lib/app-lock";
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
