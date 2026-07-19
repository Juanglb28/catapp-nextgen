import type { RegistrationResponseJSON } from "@simplewebauthn/server";
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
import { saveCredential, setLockEnabled } from "@/modules/security/repository";
import { getSessionUser } from "@/modules/security/session";
import { verifyRegistration } from "@/modules/security/webauthn";

export const dynamic = "force-dynamic";

/** Verifica el registro, guarda la credencial y activa el bloqueo. */
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

  const body = (await request.json()) as RegistrationResponseJSON;
  const cred = await verifyRegistration(body, challenge.c);
  if (!cred) {
    return NextResponse.json({ error: "verify_failed" }, { status: 400 });
  }

  await saveCredential(user.id, cred);
  await setLockEnabled(user.id, true);
  jar.delete(CHALLENGE_COOKIE);
  // Desbloquea de inmediato: quien acaba de activar no debe quedar fuera.
  jar.set(
    UNLOCK_COOKIE,
    makeUnlockToken(user.id),
    cookieOptions(UNLOCK_TTL_MS / 1000),
  );
  return NextResponse.json({ ok: true });
}
