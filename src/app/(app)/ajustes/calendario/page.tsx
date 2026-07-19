import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GoogleCalendarSettings } from "@/modules/calendar/components/google-calendar-settings";
import {
  getAccessTokenForSettings,
  listCalendars,
  type GoogleCalendarSummary,
} from "@/modules/calendar/google";
import { getGoogleAccount } from "@/modules/calendar/repository";
import { requireTenant } from "@/modules/tenancy/context";

export const metadata: Metadata = { title: "Google Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { google } = await searchParams;
  const account = await getGoogleAccount(tenantId);

  // Si está conectado, intentamos listar sus calendarios (aunque el sync esté
  // pausado). Si Google revocó el acceso, getAccessTokenForSettings lo marca roto.
  let calendars: GoogleCalendarSummary[] = [];
  let accessFailed = false;
  if (account && account.status === "connected") {
    const accessToken = await getAccessTokenForSettings(tenantId);
    if (!accessToken) {
      // El token fue revocado o es inválido — conexión realmente rota.
      accessFailed = true;
    } else {
      try {
        calendars = await listCalendars(accessToken);
      } catch {
        // listCalendars puede fallar si el scope calendar.readonly no fue
        // concedido (solo tenemos calendar.events). Eso NO rompe la conexión
        // — los eventos se siguen creando. Simplemente dejamos la lista vacía.
      }
    }
  }

  const isConnected =
    account && account.status === "connected" && !accessFailed;
  const isBroken = account && (account.status === "broken" || accessFailed);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/ajustes"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Ajustes
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Google Calendar
        </h1>
      </div>

      {google === "connected" ? (
        <p className="flex items-center gap-2 rounded-xl border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Conectado correctamente.
        </p>
      ) : null}
      {google === "error" ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-600/30 bg-amber-600/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          No se pudo conectar. Intenta de nuevo.
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm">
        Conecta tu cuenta de Google para que tus citas aparezcan en tu
        calendario y se actualicen solas.
      </p>

      {isConnected ? (
        <GoogleCalendarSettings
          email={account.googleEmail}
          calendars={calendars}
          currentCalendarId={account.calendarId}
          syncEnabled={account.syncEnabled}
        />
      ) : isBroken ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 rounded-xl border border-amber-600/30 bg-amber-600/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Se perdió el acceso a tu cuenta de Google. Vuelve a conectarte.
          </p>
          <Button asChild className="w-full">
            <a href="/api/google/connect">Reconectar</a>
          </Button>
        </div>
      ) : (
        <Button asChild className="w-full">
          <a href="/api/google/connect">Conectar con Google</a>
        </Button>
      )}
    </div>
  );
}
