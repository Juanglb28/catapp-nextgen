"use client";

/**
 * Global error boundary para Next.js App Router (F10.B2).
 * Captura errores no manejados del layout raíz y los reporta a Sentry.
 * Documentación: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    // global-error reemplaza el layout raíz; necesita sus propias etiquetas html/body.
    <html lang="es">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground max-w-[32ch] text-sm">
          Ocurrió un error inesperado. Ya notificamos al equipo.
        </p>
        <button
          onClick={reset}
          className="bg-brand rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}
