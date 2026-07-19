import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = [
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/nueva-contrasena",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage) {
    // Con sesión activa, fuera de login/registro.
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/citas", request.url));
    }
    return NextResponse.next();
  }

  // Resto del matcher: rutas protegidas del grupo (app). Sin sesión -> login.
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/citas/:path*",
    "/clientas/:path*",
    "/finanzas/:path*",
    "/inventario/:path*",
    "/ajustes/:path*",
    "/login",
    "/registro",
    "/recuperar-contrasena",
    "/nueva-contrasena",
  ],
};
