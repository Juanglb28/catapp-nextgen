import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/modules/tenancy/components/reset-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/recuperar-contrasena");

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva contraseña
        </h1>
        <p className="text-muted-foreground text-sm">
          Elige una contraseña segura para tu cuenta.
        </p>
      </div>

      <ResetPasswordForm token={token} />

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-brand font-medium hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
