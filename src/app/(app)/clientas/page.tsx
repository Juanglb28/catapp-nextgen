import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArchivedClients } from "@/modules/clients/components/archived-clients";
import { ClientListFiltered } from "@/modules/clients/components/client-list-filtered";
import { NewClientFab } from "@/modules/clients/components/new-client-fab";
import {
  findDuplicateClientGroups,
  listArchivedClients,
  listClients,
} from "@/modules/clients/repository";
import { requireTenant } from "@/modules/tenancy/context";

export const metadata: Metadata = { title: "Clientas" };

export default async function ClientasPage() {
  const { tenantId } = await requireTenant();

  const [active, archived, dupeGroups] = await Promise.all([
    listClients(tenantId),
    listArchivedClients(tenantId),
    findDuplicateClientGroups(tenantId),
  ]);

  const isEmpty = active.length === 0 && archived.length === 0;

  return (
    <div>
      <PageHeader
        title="Clientas"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/clientas/importar">Importar Google</Link>
          </Button>
        }
      />

      {dupeGroups.length > 0 && (
        <Link
          href="/clientas/duplicados"
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <span>
            <span className="font-medium">
              {dupeGroups.length}{" "}
              {dupeGroups.length === 1
                ? "telefono duplicado"
                : "telefonos duplicados"}
            </span>{" "}
            &mdash; toca para resolver
          </span>
          <span aria-hidden="true">{">"}</span>
        </Link>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Users}
          title="Sin clientas todavia"
          description="Registra a tu primera clienta para llevar su contacto e historial. Toca el boton + para empezar."
        />
      ) : (
        <div className="space-y-4">
          <ClientListFiltered clients={active} />
          <ArchivedClients clients={archived} />
        </div>
      )}

      <NewClientFab />
    </div>
  );
}
