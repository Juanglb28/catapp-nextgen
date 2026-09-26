import { NextResponse } from "next/server";

import { offlineManifest } from "@/modules/offline/manifest";
import { getSessionUser } from "@/modules/security/session";
import { getTenant, getUserTenant } from "@/modules/tenancy/repository";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Páginas a descargar por adelantado para consulta offline (D-35). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "no_session" },
      { status: 401, headers: NO_STORE },
    );
  }
  const membership = await getUserTenant(user.id);
  if (!membership) {
    return NextResponse.json({ urls: [] }, { headers: NO_STORE });
  }
  const tenant = await getTenant(membership.tenantId);
  const urls = await offlineManifest(
    membership.tenantId,
    tenant?.timezone ?? "America/Bogota",
  );
  return NextResponse.json({ urls }, { headers: NO_STORE });
}
