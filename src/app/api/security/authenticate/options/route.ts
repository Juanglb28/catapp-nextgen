import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CHALLENGE_COOKIE, cookieOptions, signPayload } from "@/lib/app-lock";
import { getSessionUser } from "@/modules/security/session";
import { authenticationOptions } from "@/modules/security/webauthn";

export const dynamic = "force-dynamic";

/** Opciones para desbloquear con la credencial WebAuthn registrada. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const options = await authenticationOptions(user.id);
  const jar = await cookies();
  jar.set(
    CHALLENGE_COOKIE,
    signPayload({ c: options.challenge, u: user.id }),
    cookieOptions(300),
  );
  return NextResponse.json(options);
}
