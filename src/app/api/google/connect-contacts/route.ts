import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildAuthUrl,
  GOOGLE_CONTACTS_SCOPES,
} from "@/modules/calendar/google";
import { requireTenant } from "@/modules/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * Inicia el consentimiento de Google para importar contactos.
 * Igual que /api/google/connect pero guarda una cookie g_redirect_after
 * para que el callback redirija a /clientas/importar en lugar de ajustes.
 */
export async function GET(request: Request) {
  await requireTenant();

  const base =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  const state = randomUUID();
  const response = NextResponse.redirect(
    buildAuthUrl(base, state, GOOGLE_CONTACTS_SCOPES),
  );

  response.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("g_redirect_after", "/clientas/importar", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
