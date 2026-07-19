import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildAuthUrl } from "@/modules/calendar/google";
import { requireTenant } from "@/modules/tenancy/context";

export const dynamic = "force-dynamic";

/** Inicia el consentimiento de Google Calendar. Exige sesión activa. */
export async function GET(request: Request) {
  await requireTenant();

  // En Railway, el proxy termina SSL y la petición interna llega como http://.
  // Usamos BETTER_AUTH_URL (ya configurada en Railway con https://) como base
  // para que el redirect_uri enviado a Google coincida con el registrado.
  const base =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  const state = randomUUID();
  const response = NextResponse.redirect(buildAuthUrl(base, state));
  response.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
