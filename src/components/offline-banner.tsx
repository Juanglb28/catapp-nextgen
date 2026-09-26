import { WifiOff } from "lucide-react";

function formatRemaining(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} h`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} min`;
}

/**
 * Banner del modo offline (F9.B1, ampliado en D-35): avisa que la app está en
 * solo consulta y cuánto queda de la ventana de 24 h sin conexión.
 */
export function OfflineBanner({ remainingMs }: { remainingMs: number }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Sin conexión — solo consulta · disponible {formatRemaining(
        remainingMs,
      )}{" "}
      más
    </div>
  );
}
