import { CalendarDays, WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Sin conexión" };

/**
 * Pantalla de respaldo sin conexión (F9.B1, rediseño D-35). El service worker
 * la sirve desde el precache cuando, sin red, se abre una ruta que no está
 * guardada en el teléfono: Finanzas/Cumpleaños/Inventario/Ajustes, pantallas
 * de creación/edición, o una página de Citas/Clientas no descargada.
 *
 * Usa SIEMPRE el look "Atardecer" con colores fijos (no depende de la paleta
 * ni del modo oscuro del negocio): es una pantalla de marca, fuera del layout
 * de la app. El logo va precacheado en `next.config.ts` y se sirve sin el
 * optimizador de imágenes (que no existe sin red).
 */
export default function OfflinePage() {
  return (
    <main
      className="fixed inset-0 flex flex-col overflow-hidden text-[#2a4249]"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 38%, rgba(255,236,208,.95) 0%, rgba(255,236,208,0) 55%), linear-gradient(180deg, #f9dcb4 0%, #f6c992 22%, #eeb49c 44%, #d396a6 62%, #7fa9a6 82%, #09a1a1 100%)",
      }}
    >
      {/* "Sol" de luz detrás del logo */}
      <div
        aria-hidden
        className="absolute top-[34%] left-1/2 size-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,246,232,.9) 0%, rgba(255,230,200,.45) 45%, rgba(255,230,200,0) 70%)",
        }}
      />
      {/* Colinas */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[210px] w-full"
        viewBox="0 0 340 210"
        preserveAspectRatio="none"
      >
        <path
          d="M0 120 C60 90 110 105 170 118 C230 131 280 96 340 110 L340 210 L0 210Z"
          fill="#09a1a1"
          opacity=".35"
        />
        <path
          d="M0 160 C70 135 120 150 180 160 C240 170 290 145 340 152 L340 210 L0 210Z"
          fill="#067d80"
          opacity=".45"
        />
      </svg>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
        <Image
          src="/icons/icon-512.png"
          alt="Logo de CatApp"
          width={148}
          height={148}
          unoptimized
          priority
          className="size-[148px] drop-shadow-[0_10px_18px_rgba(120,60,50,0.25)]"
        />
        <h1 className="mt-1.5 text-4xl font-extrabold tracking-tight">
          CatApp
        </h1>
        <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3 py-1 text-xs font-semibold text-[#6d4a4f] backdrop-blur">
          <WifiOff className="size-3.5" aria-hidden />
          Sin conexión
        </span>
        <p className="mt-3 max-w-[250px] text-[15px] leading-snug text-[#4a3a3c]">
          No disponible en modo sin conexión a internet
        </p>
        <Link
          href="/citas"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/90 px-5 py-2.5 text-sm font-bold text-[#09a1a1] shadow-[0_6px_16px_-6px_rgba(9,90,90,0.45)]"
        >
          <CalendarDays className="size-4" aria-hidden />
          Ir a mis citas guardadas
        </Link>
      </div>

      <p className="relative z-10 pb-6 text-center text-[11px] text-white/85">
        Vuelve a intentar cuando tengas señal
      </p>
    </main>
  );
}
