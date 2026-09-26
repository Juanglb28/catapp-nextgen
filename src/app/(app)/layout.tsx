import Image from "next/image";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { PushManager } from "@/components/push-manager";
import { SwUpdater } from "@/components/sw-updater";
import { tenantDayKey, tenantDayRangeUtc } from "@/lib/dates";
import { pendingBirthdayBonusCount } from "@/modules/birthdays/repository";
import { countOverduePayments } from "@/modules/finance/repository";
import { OfflineGate } from "@/modules/offline/components/offline-gate";
import { OFFLINE_PENDING_SCRIPT } from "@/modules/offline/constants";
import { getTenantCached, requireTenant } from "@/modules/tenancy/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Exige sesión + negocio: sin sesión -> /login, sin negocio -> /onboarding.
  const { tenantId } = await requireTenant();
  // El tenant (para la TZ) se necesita antes de calcular el inicio del día de
  // hoy; los dos conteos de badges sí son independientes entre sí (B0.3),
  // así que se paralelizan (D-29: se suma el de citas por cobrar).
  const tenant = await getTenantCached(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";
  const todayStart = tenantDayRangeUtc(tenantDayKey(new Date(), tz), tz).start;
  const [birthdayCount, overdueCount] = await Promise.all([
    pendingBirthdayBonusCount(tenantId),
    countOverduePayments(tenantId, todayStart),
  ]);

  const name = tenant?.name ?? "CatApp";
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* D-35: sin red, oculta el contenido cacheado hasta que OfflineGate
          confirme ventana vigente + desbloqueo local. Corre antes de hidratar. */}
      <script dangerouslySetInnerHTML={{ __html: OFFLINE_PENDING_SCRIPT }} />
      <header className="bg-background/90 sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <Image
            src="/icons/icon-192.png"
            alt=""
            aria-hidden
            width={23}
            height={23}
            className="size-[23px] shrink-0 rounded-[6px]"
          />
          <div>
            <p className="text-primary text-base leading-tight font-bold tracking-tight">
              CatApp
            </p>
            <p className="text-muted-foreground truncate text-[11px] leading-tight">
              {name}
            </p>
          </div>
        </div>
        <div
          aria-hidden
          className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        >
          {initials}
        </div>
      </header>

      <OfflineGate>
        <main className="flex-1 px-4 pt-5 pb-24">{children}</main>
      </OfflineGate>

      <BottomNav birthdayCount={birthdayCount} overdueCount={overdueCount} />
      <SwUpdater />
      <PushManager />
    </div>
  );
}
