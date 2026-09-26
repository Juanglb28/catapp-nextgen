import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

import {
  LEGACY_CACHES,
  OFFLINE_CACHE_MAX_AGE_S,
  OFFLINE_PAGES_CACHE,
  isOfflinePagePath,
} from "@/modules/offline/constants";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Perímetro del modo offline de solo consulta (D-35). Va ANTES de
 * `defaultCache`, que cacheaba cualquier página (incluidas Finanzas/Ajustes) y
 * los GET de /api:
 *  1. /api/* → siempre red (el latido /api/offline/status nunca debe salir de
 *     caché, y ningún dato de API queda guardado en el teléfono).
 *  2. Payloads RSC (navegación interna de Next) → siempre red. Sin conexión
 *     Next cae a navegación completa del documento, que resuelve la regla 3.
 *  3. Citas y Clientas (documento HTML) → NetworkFirst en una caché propia;
 *     aquí también caen las descargas por adelantado de `warmIfDue`.
 *  4. Cualquier otra navegación → siempre red (sin red: fallback /offline).
 */
const offlineRuntimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, request }) =>
      sameOrigin && request.headers.get("RSC") === "1",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, request, url }) =>
      sameOrigin && request.method === "GET" && isOfflinePagePath(url.pathname),
    handler: new NetworkFirst({
      cacheName: OFFLINE_PAGES_CACHE,
      networkTimeoutSeconds: 8,
      // La navegación y la descarga por `fetch` difieren en cabeceras Vary.
      matchOptions: { ignoreVary: true },
      plugins: [
        new ExpirationPlugin({
          maxEntries: 150,
          maxAgeSeconds: OFFLINE_CACHE_MAX_AGE_S,
        }),
        {
          // Solo 200 "reales": nunca guardar un redirect a /login bajo /citas.
          cacheWillUpdate: async ({ response }) =>
            response.status === 200 && !response.redirected ? response : null,
        },
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, request }) =>
      sameOrigin && request.mode === "navigate",
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  // App shell + estáticos del build (CacheFirst implícito del precache).
  precacheEntries: self.__SW_MANIFEST,
  // No activamos solos: esperamos a que la usuaria pulse "Actualizar" (F9.B1).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  // Perímetro offline propio (D-35) + defaultCache para estáticos.
  runtimeCaching: [...offlineRuntimeCaching, ...defaultCache],
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

// D-35: borra las cachés que antes guardaban cualquier página/API.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(LEGACY_CACHES.map((name) => caches.delete(name))),
  );
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
      .then(async (clientList) => {
        // Si la app ya está abierta, la enfoca Y la lleva a la URL de la
        // notificación (antes solo enfocaba y dejaba al usuario donde estaba).
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) {
              try {
                await (client as WindowClient).navigate(url);
              } catch {
                /* navegación no permitida: al menos se enfoca */
              }
            }
            await client.focus();
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

serwist.addEventListeners();
