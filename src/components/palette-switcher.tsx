"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import {
  applyPalette,
  normalizePalette,
  PALETTE_STORAGE_KEY,
  PALETTES,
  type PaletteId,
} from "@/lib/palettes";

/**
 * Selector de tema de color (B6). Cambia la paleta de la app (re-skin completo)
 * de forma independiente al modo claro/oscuro. Se guarda por dispositivo en
 * localStorage; el script inline del layout la aplica antes del primer render
 * para evitar el parpadeo.
 */
export function PaletteSwitcher() {
  const [palette, setPalette] = useState<PaletteId>("clasico");

  useEffect(() => {
    setPalette(normalizePalette(localStorage.getItem(PALETTE_STORAGE_KEY)));
  }, []);

  function choose(id: PaletteId) {
    setPalette(id);
    applyPalette(id);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // localStorage no disponible: no persiste, sin romper la UI.
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <p className="font-medium">Tema de color</p>
      <p className="text-muted-foreground mb-3 text-sm">
        Elige la paleta de la app. Funciona con el modo claro y oscuro.
      </p>
      <div className="grid gap-2">
        {PALETTES.map((p) => {
          const selected = palette === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              aria-pressed={selected}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-primary ring-primary ring-1"
                  : "hover:bg-accent"
              }`}
            >
              <span className="flex -space-x-1" aria-hidden>
                {p.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="size-5 rounded-full border border-white/60 shadow-sm"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="flex-1 font-medium">{p.name}</span>
              {selected ? (
                <Check className="text-primary size-4 shrink-0" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
