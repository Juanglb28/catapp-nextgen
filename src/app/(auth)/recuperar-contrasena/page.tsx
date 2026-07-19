import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/modules/tenancy/components/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-muted-foreground text-sm">
          Ingresa tu correo y te enviaremos un enlace para restablecer tu
          contraseña.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-brand font-medium hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
