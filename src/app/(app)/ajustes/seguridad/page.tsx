import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { isLockEnabled } from "@/modules/security/repository";
import { requireTenant } from "@/modules/tenancy/context";

import { AppLockSettings } from "./app-lock-settings";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SeguridadPage() {
  const { userId } = await requireTenant();
  const enabled = await isLockEnabled(userId);

  return (
    <div className="space-y-6">
      <PageHeader title="Seguridad" />
      <p className="text-muted-foreground text-sm">
        Agrega una segunda capa para entrar a Finanzas y Ajustes usando la
        huella (o el desbloqueo) de tu celular. Si no está disponible, podrás
        usar la contraseña de tu cuenta.
      </p>
      <AppLockSettings enabled={enabled} />
    </div>
  );
}
