import { Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireTenant } from "@/modules/tenancy/context";
import { NewServiceButton } from "@/modules/services/components/new-service-button";
import { ServiceRow } from "@/modules/services/components/service-row";
import { listServices } from "@/modules/services/repository";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const { tenantId } = await requireTenant();
  const all = await listServices(tenantId, { includeInactive: true });
  const active = all.filter((s) => s.active);
  const inactive = all.filter((s) => !s.active);

  return (
    <div>
      <Link
        href="/ajustes"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Ajustes
      </Link>

      <div className="mt-3">
        <PageHeader title="Servicios" action={<NewServiceButton />} />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Sin servicios todavía"
          description="Agrega tus servicios con precio y duración para usarlos al crear citas."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <ul className="space-y-2">
              {active.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No tienes servicios activos.
            </p>
          )}

          {inactive.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-muted-foreground text-sm font-medium">
                Inactivos ({inactive.length})
              </h2>
              <ul className="space-y-2">
                {inactive.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
