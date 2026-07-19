import { headers } from "next/headers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  UNLOCK_COOKIE,
  cookieOptions,
  makeUnlockToken,
  UNLOCK_TTL_MS,
} from "@/lib/app-lock";
import { getSessionUser } from "@/modules/security/session";

export const dynamic = "force-dynamic";

/** Respaldo: desbloquea verificando la contraseña de la cuenta. */
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

  const jar = await cookies();
  jar.set(
    UNLOCK_COOKIE,
    makeUnlockToken(user.id),
    cookieOptions(UNLOCK_TTL_MS / 1000),
  );
  return NextResponse.json({ ok: true });
}
