import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCode } from "@/modules/calendar/google";
import { saveGoogleAccount } from "@/modules/calendar/repository";
import { requireTenant } from "@/modules/tenancy/context";

export const dynamic = "force-dynamic";

/** Callback de Google: intercambia el código y guarda la conexión (cifrada). */
export async function GET(request: Request) {
  const { tenantId } = await requireTenant();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("g_oauth_state")?.value;
  // Ruta de regreso opcional (p.ej. /clientas/importar para el flujo de contactos).
  const redirectAfter = cookieStore.get("g_redirect_after")?.value;

  // Usar BETTER_AUTH_URL como base pública para:
  // 1. redirect_uri del intercambio de código (debe coincidir con el de la autorización)
  // 2. URL de destino después del callback (evita redirigir a localhost interno)
  const publicBase =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? url.origin;

  const defaultRedirect = new URL("/ajustes/calendario", publicBase);
  const dest = redirectAfter
    ? new URL(redirectAfter, publicBase)
    : defaultRedirect;

  function finishWith(param: string, value: string) {
    dest.searchParams.set(param, value);
    const res = NextResponse.redirect(dest);
    res.cookies.delete("g_oauth_state");
    res.cookies.delete("g_redirect_after");
    return res;
  }

  // Validación CSRF + errores del consentimiento.
  if (
    url.searchParams.get("error") ||
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState
  ) {
    console.error("[google/callback] validación fallida", {
      googleError: url.searchParams.get("error"),
      hasCode: !!code,
      hasState: !!state,
      hasExpectedState: !!expectedState,
      stateMatch: state === expectedState,
    });
    return finishWith("google", "error");
  }

  try {
    const { refreshToken, email } = await exchangeCode(publicBase, code);
    await saveGoogleAccount(tenantId, { googleEmail: email, refreshToken });
    return finishWith("google", "connected");
  } catch (err) {
    console.error(
      "[google/callback] exchangeCode/saveAccount falló:",
      err instanceof Error ? err.message : String(err),
    );
    return finishWith("google", "error");
  }
}
