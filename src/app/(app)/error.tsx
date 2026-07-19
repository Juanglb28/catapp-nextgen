"use client";

/**
 * Error boundary del grupo autenticado (B0.5). Antes, cualquier throw en un
 * Server Component de (app) (p.ej. fallo de DB en Finanzas) caía al
 * global-error, que reemplaza TODA la app. Este boundary lo contiene en el
 * segmento: se mantiene header/nav y se ofrece reintentar. Reporta a Sentry.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-[32ch] text-sm">
        No pudimos cargar esta sección. Puedes reintentar; si sigue fallando, ya
        notificamos al equipo.
      </p>
      <button
        onClick={reset}
        className="bg-brand-gradient-deep rounded-md px-4 py-2 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </div>
  );
}
