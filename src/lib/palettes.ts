/**
 * Paletas de color de la app (B6). Ortogonales a light/dark: `data-palette` en
 * <html> selecciona el re-skin; la clase `.dark` sigue controlando el modo. La
 * paleta se guarda por dispositivo en `localStorage` ("catapp-palette"), igual
 * que el modo oscuro. "Clásico" es el default (no pone atributo). Los tokens de
 * cada paleta viven en `globals.css`. Colores base del PDF de referencia.
 */

export type PaletteId =
  | "clasico"
  | "esmeralda"
  | "atardecer"
  | "coral"
  | "safiro";

export const PALETTE_STORAGE_KEY = "catapp-palette";

export type Palette = {
  id: PaletteId;
  name: string;
  /** 3 muestras representativas para el swatch del selector. */
  swatch: [string, string, string];
};

export const PALETTES: Palette[] = [
  { id: "clasico", name: "Clásico", swatch: ["#0891b2", "#10b981", "#0ea5e9"] },
  { id: "esmeralda", name: "Esmeralda", swatch: ["#05ad98", "#878787", "#bbbfbf"] },
  { id: "atardecer", name: "Atardecer", swatch: ["#09a1a1", "#f6c992", "#d396a6"] },
  { id: "coral", name: "Coral", swatch: ["#b44446", "#fc8f8f", "#64242f"] },
  { id: "safiro", name: "Safiro", swatch: ["#0474c4", "#5379ae", "#a8c4ec"] },
];

const IDS = new Set<string>(PALETTES.map((p) => p.id));

/** Normaliza un valor arbitrario a una paleta válida (default "clasico"). */
export function normalizePalette(value: string | null | undefined): PaletteId {
  return value && IDS.has(value) ? (value as PaletteId) : "clasico";
}

/** Aplica la paleta al documento (atributo `data-palette`). "clasico" = sin atributo. */
export function applyPalette(id: PaletteId): void {
  const root = document.documentElement;
  if (id === "clasico") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", id);
}
