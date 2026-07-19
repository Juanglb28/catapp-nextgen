import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

/** Página de respaldo cuando una ruta no cacheada se abre sin red (F9.B1). */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <WifiOff className="text-muted-foreground size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Sin conexión</h1>
      <p className="text-muted-foreground text-sm">
        No pudimos cargar esta pantalla porque no hay internet. Lo que ya habías
        abierto sigue disponible; vuelve a intentar cuando tengas señal.
      </p>
    </main>
  );
}
