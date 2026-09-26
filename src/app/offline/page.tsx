import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sin conexión" };

/**
 * Página de respaldo cuando una ruta no disponible offline se abre sin red
 * (F9.B1). Desde D-35 solo Citas y Clientas se consultan sin conexión.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <WifiOff className="text-muted-foreground size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Sin conexión</h1>
      <p className="text-muted-foreground text-sm">
        Esta pantalla no está disponible porque no hay internet. Sin conexión
        puedes consultar tu agenda y tus clientas; vuelve a intentar cuando
        tengas señal.
      </p>
      <Link
        href="/citas"
        className="text-primary text-sm font-medium underline underline-offset-4"
      >
        Ir a mis citas
      </Link>
    </main>
  );
}
