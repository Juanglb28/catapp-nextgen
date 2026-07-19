import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/modules/tenancy/components/google-button";
import { LoginForm } from "@/modules/tenancy/components/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
        <p className="text-muted-foreground text-sm">
          Bienvenida de vuelta a CatApp.
        </p>
      </div>

      <LoginForm resetOk={reset === "ok"} />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">o</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <GoogleButton label="Continuar con Google" />

      <p className="text-muted-foreground text-center text-sm">
        ¿No tienes cuenta?{" "}
        <Link
          href="/registro"
          className="text-brand font-medium hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}
