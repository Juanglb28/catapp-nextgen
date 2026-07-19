import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/modules/tenancy/components/google-button";
import { RegisterForm } from "@/modules/tenancy/components/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Crea tu cuenta
        </h1>
        <p className="text-muted-foreground text-sm">
          Empieza a gestionar tu negocio con CatApp.
        </p>
      </div>

      <RegisterForm />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">o</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <GoogleButton label="Continuar con Google" />

      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
