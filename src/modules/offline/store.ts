/**
 * Persistencia del modo offline en el dispositivo (D-35): IndexedDB para lo
 * que debe sobrevivir al cierre de la app (estado de la ventana de 24 h,
 * verificador de contraseña, credenciales de huella) y sessionStorage para el
 * desbloqueo local (se pierde al cerrar la app → "pide huella al abrir").
 * Todas las funciones toleran entornos sin IndexedDB/sessionStorage.
 */
import { OFFLINE_PAGES_CACHE } from "./constants";
import type { PasswordVerifier } from "./password-verifier";
import type { OfflineSession, OfflineState } from "./policy";

const DB_NAME = "catapp-offline";
const STORE = "kv";
const SESSION_KEY = "catapp-offline-session";

export type OfflineCredentials = { rpId: string; ids: string[] };

type Keys = {
  state: OfflineState;
  verifier: PasswordVerifier;
  credentials: OfflineCredentials;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest | void,
): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export async function getItem<K extends keyof Keys>(
  key: K,
): Promise<Keys[K] | null> {
  try {
    return ((await tx<Keys[K]>("readonly", (s) => s.get(key))) ?? null) as
      | Keys[K]
      | null;
  } catch {
    return null;
  }
}

export async function setItem<K extends keyof Keys>(
  key: K,
  value: Keys[K],
): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(value, key));
  } catch {
    /* sin IndexedDB (modo privado): el offline simplemente no se habilita */
  }
}

export async function deleteItem(key: keyof Keys): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}

export function getSession(): OfflineSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OfflineSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: OfflineSession | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Borra las páginas guardadas para consulta offline. */
export async function purgeOfflinePages(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(OFFLINE_PAGES_CACHE);
  } catch {
    /* ignore */
  }
}

/**
 * Borra TODO rastro offline del dispositivo: páginas, estado, verificador,
 * credenciales y desbloqueo. Se llama al cerrar sesión, al iniciar sesión de
 * nuevo (posible otra cuenta) y cuando el servidor responde "sin sesión".
 */
export async function clearOfflineData(): Promise<void> {
  setSession(null);
  await Promise.all([
    purgeOfflinePages(),
    deleteItem("state"),
    deleteItem("verifier"),
    deleteItem("credentials"),
  ]);
}
