import {
  CalendarDays,
  ChevronRight,
  MessageSquare,
  Pencil,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import { BusinessPublicInfoSheet } from "@/modules/tenancy/components/business-public-info-sheet";
import { LogoutButton } from "@/modules/tenancy/components/logout-button";
import { AutoMessagesToggle } from "@/modules/whatsapp/components/auto-messages-toggle";
import { isWhatsAppEnabled } from "@/modules/whatsapp/cloud-api";
import { InstallCard } from "@/modules/pwa/components/install-card";
import { EnablePushButton } from "@/modules/push/components/enable-push-button";
import { TestPushButton } from "@/modules/push/components/test-push-button";
import { BirthdayBonusSettingsSheet } from "@/modules/tenancy/components/birthday-bonus-settings-sheet";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Ajustes" };

function formatCOP(amount: bigint): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default async function AjustesPage() {
  const { tenantId } = await requireTenant();
  const tenant = await getTenant(tenantId);

  return (
    <div className="space-y-6">
      <PageHeader title="Ajustes" />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Catálogo</h2>
        <Link
          href="/ajustes/servicios"
          className="hover:bg-accent flex items-center gap-3 rounded-xl border px-3 py-3"
        >
          <Scissors
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Servicios</p>
            <p className="text-muted-foreground text-sm">
              Precios y duración de lo que ofreces.
            </p>
          </div>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </Link>
        <Link
          href="/ajustes/mensajes"
          className="hover:bg-accent flex items-center gap-3 rounded-xl border px-3 py-3"
        >
          <MessageSquare
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Mensajes</p>
            <p className="text-muted-foreground text-sm">
              Textos de WhatsApp para tus clientas.
            </p>
          </div>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Notificaciones</h2>
        <div className="space-y-2 rounded-xl border px-3 py-3">
          <p className="text-muted-foreground text-sm">
            Avisos de cumpleaños, citas de mañana y cuando una clienta confirma
            o rechaza su cita.
          </p>
          <div className="flex flex-wrap gap-2">
            <EnablePushButton />
            <TestPushButton />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Seguridad</h2>
        <Link
          href="/ajustes/seguridad"
          className="hover:bg-accent flex items-center gap-3 rounded-xl border px-3 py-3"
        >
          <ShieldCheck
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Bloqueo de Finanzas y Ajustes</p>
            <p className="text-muted-foreground text-sm">
              Pide tu huella o contraseña para entrar.
            </p>
          </div>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Integraciones</h2>
        <Link
          href="/ajustes/calendario"
          className="hover:bg-accent flex items-center gap-3 rounded-xl border px-3 py-3"
        >
          <CalendarDays
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Google Calendar</p>
            <p className="text-muted-foreground text-sm">
              Sincroniza tus citas con tu calendario.
            </p>
          </div>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </Link>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Información pública</h2>
          <BusinessPublicInfoSheet
            initial={{
              publicAddress: tenant?.publicAddress ?? "",
              publicNote: tenant?.publicNote ?? "",
            }}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="size-4" />
                Editar
              </Button>
            }
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Dirección y nota que ven tus clientas en el enlace de su cita.
        </p>
        <div className="rounded-xl border p-3 text-sm">
          {tenant?.publicAddress ? (
            <p>{tenant.publicAddress}</p>
          ) : (
            <p className="text-muted-foreground">Sin dirección pública.</p>
          )}
          {tenant?.publicNote ? (
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
              {tenant.publicNote}
            </p>
          ) : null}
        </div>
      </section>

      {/* El toggle solo tiene efecto si la Cloud API de WhatsApp está configurada.
          Sin ella era un control que no hacía nada (C-3, B1.4): se etiqueta. */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Mensajes automáticos</h2>
        {isWhatsAppEnabled() ? (
          <AutoMessagesToggle initial={tenant?.autoMessages ?? true} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Próximamente. Por ahora envía los recordatorios y mensajes tú misma
            por WhatsApp desde cada cita (con un toque).
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Bono de cumpleaños</h2>
          <BirthdayBonusSettingsSheet
            initial={{
              bonusManicureCop: Number(tenant?.bonusManicureCop ?? 0n),
              bonusVeloterapiaCop: Number(tenant?.bonusVeloterapiaCop ?? 0n),
            }}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="size-4" />
                Editar
              </Button>
            }
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Valor que se descuenta al aplicar el bono en una cita.
        </p>
        <div className="rounded-xl border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Manicure tradicional</span>
            <span>{formatCOP(tenant?.bonusManicureCop ?? 0n)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">
              Veloterapia con exfoliación
            </span>
            <span>{formatCOP(tenant?.bonusVeloterapiaCop ?? 0n)}</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Apariencia</h2>
        <ThemeToggle />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Aplicación</h2>
        <InstallCard />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cuenta</h2>
        <LogoutButton />
      </section>
    </div>
  );
}
