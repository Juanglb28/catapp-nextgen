import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import {
  listDeclinedBonuses,
  listPendingBonuses,
} from "@/modules/birthdays/repository";
import { buildWaLink, renderTemplate } from "@/modules/whatsapp/templates";
import { getTemplates } from "@/modules/whatsapp/repository";
import { BonusCard } from "./bonus-card";
import { DeclinedBonusesSection } from "./declined-bonus-section";

export const metadata: Metadata = { title: "Cumpleaños" };

export default async function CumpleanosPage() {
  const { tenantId } = await requireTenant();
  const [bonuses, tenant, templates, declinedBonuses] = await Promise.all([
    listPendingBonuses(tenantId),
    getTenant(tenantId),
    getTemplates(tenantId),
    listDeclinedBonuses(tenantId),
  ]);

  const headersList = await headers();
  const host = headersList.get("host") ?? "catapp-production.up.railway.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const businessName = tenant?.name ?? "";
  const birthdayTemplate = templates.birthday;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cumpleaños</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Clientas con bono de cumpleaños pendiente.
        </p>
      </div>

      {bonuses.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center text-sm">
          <span className="text-3xl">🎂</span>
          <p>No hay bonos de cumpleaños pendientes.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {bonuses.map((bonus) => {
            const bonusUrl = `${baseUrl}/cumpleanos/${bonus.publicToken}`;
            const waText = renderTemplate(birthdayTemplate, {
              clienta: bonus.clientName,
              negocio: businessName,
              link: bonusUrl,
            });
            const waHref = buildWaLink(bonus.clientPhone, waText);
            // chosenOption ya es la etiqueta (snapshot) tras B1.1.
            const chosenLabel = bonus.chosenOption ?? null;

            return (
              <BonusCard
                key={bonus.id}
                bonus={{
                  id: bonus.id,
                  status: bonus.status,
                  clientName: bonus.clientName,
                  clientPhone: bonus.clientPhone,
                  chosenLabel,
                  publicToken: bonus.publicToken,
                }}
                waHref={waHref}
              />
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Los bonos se crean automáticamente el día del cumpleaños de cada clienta
        que tenga fecha registrada.
      </p>

      <DeclinedBonusesSection
        bonuses={declinedBonuses.map((b) => ({
          id: b.id,
          clientName: b.clientName,
          clientPhone: b.clientPhone,
          declinedFromStatus: b.declinedFromStatus,
        }))}
      />
    </div>
  );
}
