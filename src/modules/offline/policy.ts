import {
  CLOCK_TOLERANCE_MS,
  OFFLINE_IDLE_LOCK_MS,
  OFFLINE_WINDOW_MS,
} from "./constants";

/**
 * Reglas puras del modo offline (D-35). Todo en milisegundos de reloj local
 * (`Date.now()` del dispositivo); la detección de manipulación se basa en que
 * el reloj nunca debería retroceder respecto al máximo ya observado.
 */

/** Estado persistido (IndexedDB) tras la última confirmación con el servidor. */
export type OfflineState = {
  userId: string;
  /** Reloj local en la última respuesta autenticada del servidor. */
  lastOnlineAt: number;
  /** Máximo reloj local observado (se actualiza también sin conexión). */
  lastSeenAt: number;
  /** Última descarga por adelantado completada (reloj local). */
  lastWarmAt?: number;
};

/** Desbloqueo local de la sesión de la pestaña (sessionStorage). */
export type OfflineSession = {
  unlockedAt: number;
  lastActivityAt: number;
};

export type WindowVerdict =
  | { kind: "no-data" }
  | { kind: "tampered" }
  | { kind: "expired" }
  | { kind: "ok"; remainingMs: number };

/** ¿Se puede consultar sin conexión según la ventana de 24 h y el reloj? */
export function evaluateOfflineWindow(
  state: OfflineState | null,
  now: number,
): WindowVerdict {
  if (!state) return { kind: "no-data" };
  // Reloj movido hacia atrás más allá de la tolerancia: no confiamos en él.
  if (now + CLOCK_TOLERANCE_MS < state.lastSeenAt) return { kind: "tampered" };
  if (now + CLOCK_TOLERANCE_MS < state.lastOnlineAt)
    return { kind: "tampered" };
  const elapsed = now - state.lastOnlineAt;
  if (elapsed > OFFLINE_WINDOW_MS) return { kind: "expired" };
  return { kind: "ok", remainingMs: OFFLINE_WINDOW_MS - Math.max(0, elapsed) };
}

/** ¿Hay que pedir huella/contraseña (al abrir o tras 15 min inactiva)? */
export function needsLocalUnlock(
  session: OfflineSession | null,
  now: number,
): boolean {
  if (!session) return true;
  if (now + CLOCK_TOLERANCE_MS < session.lastActivityAt) return true;
  return now - session.lastActivityAt > OFFLINE_IDLE_LOCK_MS;
}

/** Nuevo estado con el reloj observado (nunca retrocede `lastSeenAt`). */
export function observeClock(state: OfflineState, now: number): OfflineState {
  return now > state.lastSeenAt ? { ...state, lastSeenAt: now } : state;
}

/** Estado tras una respuesta autenticada del servidor. */
export function confirmOnline(
  prev: OfflineState | null,
  userId: string,
  now: number,
): OfflineState {
  const same = prev?.userId === userId ? prev : null;
  return {
    userId,
    lastOnlineAt: now,
    // Con conexión el reloj se revalida: si se había atrasado a propósito, la
    // nueva confirmación lo "reinicia" (el servidor es la autoridad, D-35).
    lastSeenAt: now,
    lastWarmAt: same?.lastWarmAt,
  };
}

/** ¿Toca volver a descargar las páginas por adelantado? */
export function shouldWarm(
  state: OfflineState | null,
  now: number,
  intervalMs: number,
): boolean {
  if (!state?.lastWarmAt) return true;
  if (now < state.lastWarmAt) return true;
  return now - state.lastWarmAt >= intervalMs;
}
