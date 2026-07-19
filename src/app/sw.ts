import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // App shell + estáticos del build (CacheFirst implícito del precache).
  precacheEntries: self.__SW_MANIFEST,
  // No activamos solos: esperamos a que la usuaria pulse "Actualizar" (F9.B1).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache: páginas/navegación con NetworkFirst (datos frescos con red,
  // caché como respaldo sin señal); estáticos con CacheFirst.
  runtimeCaching: defaultCache,
  // Si una navegación falla y la ruta no está cacheada, mostramos /offline.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// El toast "Hay una nueva versión" hace postMessage para activar el SW nuevo.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push notifications (alertas de cumpleaños) ──────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: "CatApp", body: event.data.text() };
  }

  const title = payload.title ?? "CatApp";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    data: { url: payload.url ?? "/cumpleanos" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string = (event.notification.data?.url as string) ?? "/cumpleanos";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            void client.focus();
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

serwist.addEventListeners();
