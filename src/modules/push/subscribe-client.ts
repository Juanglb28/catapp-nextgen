/**
 * Suscripción Web Push del dispositivo actual (lado cliente).
 * Compartido por `<PushManager>` (intento silencioso al cargar) y por el botón
 * "Activar notificaciones" de Ajustes (con diagnóstico visible).
 */

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "no_key" | "denied" | "failed" };

/** Convierte la VAPID public key de base64url a Uint8Array para la Push API. */
export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(
    [...rawData].map((c) => c.charCodeAt(0)),
  ) as Uint8Array<ArrayBuffer>;
}

/**
 * Registra este dispositivo para recibir push. Idempotente: si ya hay
 * suscripción, la reenvía al servidor para refrescarla.
 */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  // Debe leerse literal para que Next.js la incruste en el bundle.
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, reason: "no_key" };

  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window === "undefined" ||
    !("PushManager" in window)
  ) {
    return { ok: false, reason: "unsupported" };
  }

  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return { ok: false, reason: "denied" };
      }
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return { ok: false, reason: "failed" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
