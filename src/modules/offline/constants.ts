/**
 * Constantes del modo offline de solo consulta (D-35). Se comparten entre el
 * service worker (`src/app/sw.ts`) y el cliente, así que este archivo NO debe
 * importar nada del servidor ni de React.
 */

/** Caché del SW con las páginas consultables sin conexión. */
export const OFFLINE_PAGES_CACHE = "catapp-offline-pages";

/**
 * Cachés que el `defaultCache` de Serwist llenaba antes de D-35 (incluían
 * páginas de Finanzas/Ajustes y respuestas de /api). Se borran al activar el
 * SW nuevo para no dejar datos fuera del perímetro offline.
 */
export const LEGACY_CACHES = [
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "others",
  "apis",
] as const;

/** Ventana máxima sin conexión antes de exigir reconexión (D-35). */
export const OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Inactividad tras la cual se vuelve a pedir huella/contraseña offline. */
export const OFFLINE_IDLE_LOCK_MS = 15 * 60 * 1000;

/**
 * Tolerancia para saltos de reloj hacia atrás (ajustes automáticos de NTP,
 * cambio de horario). Retrocesos mayores se tratan como manipulación.
 */
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/** Vida de las páginas en caché: la ventana offline + margen. */
export const OFFLINE_CACHE_MAX_AGE_S = 25 * 60 * 60;

/** Cada cuánto se re-descargan las páginas por adelantado estando en línea. */
export const OFFLINE_WARM_INTERVAL_MS = 30 * 60 * 1000;

/** Cada cuánto se confirma la sesión con el servidor estando en línea. */
export const OFFLINE_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/** Días de agenda (hoy incluido) que se descargan por adelantado. */
export const OFFLINE_AGENDA_DAYS = 8;

/** Tope de fichas (citas + clientas) descargadas por adelantado. */
export const OFFLINE_MAX_DETAIL_PAGES = 80;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OFFLINE_PATH_RE = new RegExp(`^/(citas|clientas)(/${UUID})?/?$`, "i");

/**
 * True si la ruta es consultable sin conexión: agenda (/citas, con sus vistas
 * por query), detalle de cita, lista y ficha de clientas. Quedan fuera
 * /citas/nueva, /clientas/importar, /clientas/duplicados, Finanzas, Ajustes,
 * Cumpleaños e Inventario.
 */
export function isOfflinePagePath(pathname: string): boolean {
  return OFFLINE_PATH_RE.test(pathname);
}

/** Atributo que el script previo a la hidratación pone en <html> sin red. */
export const OFFLINE_PENDING_ATTR = "data-offline-pending";

/**
 * Se ejecuta ANTES de que React hidrate: si el teléfono está sin red, oculta
 * el contenido (servido desde caché) hasta que `OfflineGate` decida si se
 * puede mostrar. Evita que los datos se vean un instante sin desbloquear.
 */
export const OFFLINE_PENDING_SCRIPT = `try{if(!navigator.onLine)document.documentElement.setAttribute("${OFFLINE_PENDING_ATTR}","")}catch(e){}`;
