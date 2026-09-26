import { NextResponse } from "next/server";

import { rpConfig } from "@/lib/app-lock";
import { listCredentials } from "@/modules/security/repository";
import { getSessionUser } from "@/modules/security/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Latido del modo offline (D-35). Con sesión válida el teléfono reinicia su
 * ventana de 24 h y actualiza las credenciales de huella con las que podrá
 * desbloquear sin conexión. Sin sesión → 401 y el cliente borra sus datos
 * offline. Nunca se cachea (el SW también lo trata como NetworkOnly).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "no_session" },
      { status: 401, headers: NO_STORE },
    );
  }
  const creds = await listCredentials(user.id);
  return NextResponse.json(
    {
      userId: user.id,
      serverTime: Date.now(),
      rpId: rpConfig().rpID,
      credentialIds: creds.map((c) => c.credentialId),
    },
    { headers: NO_STORE },
  );
}
