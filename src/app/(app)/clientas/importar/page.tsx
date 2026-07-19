import { ArrowLeft, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ContactsImportUI } from "@/modules/clients/components/contacts-import-ui";
import { SyncBirthdaysButton } from "@/modules/clients/components/sync-birthdays-button";
import { getContactsForImport } from "@/modules/clients/google-contacts";
import { requireTenant } from "@/modules/tenancy/context";

export const metadata: Metadata = { title: "Importar desde Google" };
export const dynamic = "force-dynamic";

export default async function ImportarContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { google } = await searchParams;

  const result = await getContactsForImport(tenantId);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/clientas">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          Importar desde Google
        </h1>
      </div>

      {/* Error OAuth (parámetro ?google=error) */}
      {google === "error" && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-lg px-4 py-3 text-sm">
          No se pudo conectar con Google. Intenta de nuevo.
        </div>
      )}

      {/* Estado: sin cuenta conectada */}
      {result.status === "not_connected" && (
        <ConnectCard
          title="Conecta tu cuenta de Google"
          description="Autoriza el acceso para ver tus contactos e importarlos como clientas."
          buttonLabel="Conectar Google"
        />
      )}

      {/* Estado: token revocado */}
      {result.status === "broken" && (
        <ConnectCard
          title="Conexión con Google expirada"
          description="Google revocó el acceso. Vuelve a autorizar para continuar."
          buttonLabel="Reconectar Google"
        />
      )}

      {/* Estado: falta el scope contacts.readonly */}
      {result.status === "needs_scope" && (
        <ConnectCard
          title="Permiso de contactos requerido"
          description="Debes autorizar acceso de lectura a tus contactos de Google."
          buttonLabel="Autorizar acceso a contactos"
        />
      )}

      {/* Estado: error inesperado al llamar la API */}
      {result.status === "error" && (
        <div className="space-y-4">
          <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
            Error al obtener contactos: {result.message}
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href="/api/google/connect-contacts">
              <RefreshCw className="size-4" />
              Reintentar
            </a>
          </Button>
        </div>
      )}

      {/* Estado: OK — sincronizar cumpleaños + lista con checkboxes */}
      {result.status === "ok" && (
        <div className="space-y-4">
          <SyncBirthdaysButton />
          <ContactsImportUI contacts={result.contacts} />
        </div>
      )}
    </div>
  );
}

function ConnectCard({
  title,
  description,
  buttonLabel,
}: {
  title: string;
  description: string;
  buttonLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Button asChild>
        <a href="/api/google/connect-contacts">{buttonLabel}</a>
      </Button>
    </div>
  );
}
