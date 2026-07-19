import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  CHALLENGE_COOKIE,
  UNLOCK_COOKIE,
  cookieOptions,
  makeUnlockToken,
  UNLOCK_TTL_MS,
  verifyPayload,
} from "@/lib/app-lock";
import {
  getCredential,
  updateCredentialCounter,
} from "@/modules/security/repository";
import { getSessionUser } from "@/modules/security/session";
import { verifyAuthentication } from "@/modules/security/webauthn";

export const dynamic = "force-dynamic";

/** Verifica la huella/desbloqueo nativo y concede el desbloqueo por sesión. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const jar = await cookies();
  const challenge = verifyPayload<{ c: string; u: string }>(
    jar.get(CHALLENGE_COOKIE)?.value,
  );
  if (!challenge || challenge.u !== user.id) {
    return NextResponse.json({ error: "no_challenge" }, { status: 400 });
  }

  const body = (await request.json()) as AuthenticationResponseJSON;
  const stored = await getCredential(body.id);
  if (!stored || stored.userId !== user.id) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 400 });
  }

  const result = await verifyAuthentication(body, challenge.c, stored);
  if (!result) {
    return NextResponse.json({ error: "verify_failed" }, { status: 401 });
  }

  await updateCredentialCounter(stored.credentialId, result.newCounter);
  jar.delete(CHALLENGE_COOKIE);
  jar.set(
    UNLOCK_COOKIE,
    makeUnlockToken(user.id),
    cookieOptions(UNLOCK_TTL_MS / 1000),
  );
  return NextResponse.json({ ok: true });
}
