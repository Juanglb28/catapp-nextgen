/**
 * Orquestación del modo offline en el navegador (D-35): confirmación de
 * sesión con el servidor, descarga por adelantado y captura del verificador
 * de contraseña. Sin React; lo usa `OfflineGate`.
 */
import {
  OFFLINE_MAX_DETAIL_PAGES,
  OFFLINE_WARM_INTERVAL_MS,
} from "./constants";
import { createPasswordVerifier } from "./password-verifier";
import { confirmOnline, shouldWarm } from "./policy";
import {
  clearOfflineData,
  getItem,
  purgeOfflinePages,
  setItem,
  setSession,
} from "./store";

export type HeartbeatResult = "online" | "signed-out" | "network-error";

type StatusResponse = {
  userId: string;
  rpId: string;
  credentialIds: string[];
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Confirma la sesión con el servidor. En éxito reinicia la ventana de 24 h,
 * guarda las credenciales de huella y marca la pestaña como desbloqueada
 * (estar en línea con sesión válida = ya autenticada por Better Auth).
 */
export async function heartbeat(): Promise<HeartbeatResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout("/api/offline/status", 8_000);
  } catch {
    return "network-error";
  }
  if (res.status === 401) {
    await clearOfflineData();
    return "signed-out";
  }
  if (!res.ok) return "network-error";

  const body = (await res.json()) as StatusResponse;
  const now = Date.now();
  const prev = await getItem("state");
  if (prev && prev.userId !== body.userId) {
    // Otra cuenta en el mismo teléfono: nada de la anterior debe quedar.
    await purgeOfflinePages();
  }
  await setItem("state", confirmOnline(prev, body.userId, now));
  await setItem("credentials", { rpId: body.rpId, ids: body.credentialIds });

  const verifier = await getItem("verifier");
  if (verifier) {
    if (verifier.userId === null) {
      await setItem("verifier", { ...verifier, userId: body.userId });
    } else if (verifier.userId !== body.userId) {
      await setItem("verifier", {
        ...verifier,
        userId: null,
        hash: "",
        salt: "",
      });
    }
  }

  setSession({ unlockedAt: now, lastActivityAt: now });
  return "online";
}

/** Descarga por adelantado las páginas consultables (si toca). */
export async function warmIfDue(): Promise<void> {
  // Sin SW activo (dev, o primera visita) no hay dónde guardar: no gastar red.
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    return;
  }
  const state = await getItem("state");
  const now = Date.now();
  if (!state || !shouldWarm(state, now, OFFLINE_WARM_INTERVAL_MS)) return;

  let urls: string[];
  try {
    const res = await fetchWithTimeout("/api/offline/manifest", 15_000);
    if (!res.ok) return;
    urls = ((await res.json()) as { urls: string[] }).urls.slice(
      0,
      OFFLINE_MAX_DETAIL_PAGES + 20,
    );
  } catch {
    return;
  }

  // El SW guarda cada respuesta en su caché offline (NetworkFirst). De a 2
  // para no saturar el servidor ni la conexión del teléfono.
  const queue = [...urls];
  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift()!;
      try {
        await fetchWithTimeout(url, 20_000);
      } catch {
        /* una página fallida no detiene el resto */
      }
    }
  };
  await Promise.all([worker(), worker()]);

  const latest = await getItem("state");
  if (latest && latest.userId === state.userId) {
    await setItem("state", { ...latest, lastWarmAt: Date.now() });
  }
}

/**
 * Guarda el verificador local de la contraseña ya validada por el servidor.
 * `fresh: true` (inicio de sesión) borra antes cualquier dato offline previo,
 * porque puede tratarse de otra cuenta.
 */
export async function rememberPasswordForOffline(
  password: string,
  opts: { fresh: boolean },
): Promise<void> {
  try {
    if (opts.fresh) await clearOfflineData();
    const state = await getItem("state");
    const verifier = await createPasswordVerifier(
      password,
      opts.fresh ? null : (state?.userId ?? null),
    );
    await setItem("verifier", verifier);
  } catch {
    /* sin WebCrypto/IndexedDB: el offline por contraseña no queda disponible */
  }
}

export { clearOfflineData };
