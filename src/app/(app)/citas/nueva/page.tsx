import type { Metadata } from "next";
import Link from "next/link";

import { tenantDayKey, tenantNextSlot } from "@/lib/dates";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import { listClients } from "@/modules/clients/repository";
import { listServices } from "@/modules/services/repository";
import { AppointmentForm } from "@/modules/appointments/components/appointment-form";

export const metadata: Metadata = { title: "Nueva cita" };

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";
  const { cliente } = await searchParams;

  const [clients, services] = await Promise.all([
    listClients(tenantId),
    listServices(tenantId),
  ]);

  const now = new Date();

  return (
    <div>
      <Link
        href="/citas"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Citas
      </Link>
      <h1 className="mt-3 mb-5 text-2xl font-semibold tracking-tight">
        Nueva cita
      </h1>

      <AppointmentForm
        initialClientId={cliente ?? null}
        todayKey={tenantDayKey(now, tz)}
        defaultTime={tenantNextSlot(now, tz)}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
        }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          basePriceCop: Number(s.basePriceCop),
          durationMin: s.durationMin,
        }))}
      />
    </div>
  );
}
