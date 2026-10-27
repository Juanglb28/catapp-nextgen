import { withSentryConfig } from "@sentry/nextjs";
import { randomUUID } from "node:crypto";

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

/**
 * Security headers (F10.B1 — RNF-03).
 *
 * CSP notes:
 *  - `script-src 'unsafe-inline'`: required for Next.js 15 inline hydration
 *    scripts. Upgrade to nonce-based CSP when time allows (see SECURITY.md).
 *  - `script-src 'unsafe-eval'`: webpack dev source maps AND reCAPTCHA v3, que
 *    lo usa para su scoring. Relajación pequeña ('unsafe-inline' ya está puesto).
 *  - `style-src 'unsafe-inline'`: Tailwind v4 injects inline styles.
 *  - `connect-src 'self' *.sentry.io https://www.google.com
 *    https://www.gstatic.com`: Sentry SDK sends events to sentry.io;
 *    reCAPTCHA v3 fetches locale resources (e.g. recaptcha__en.js) from
 *    gstatic.com, not just google.com.
 *  - `worker-src 'self'`: Serwist service worker.
 *  - `frame-ancestors 'none'`: equivalent to X-Frame-Options DENY.
 */
const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection (belt-and-suspenders with CSP frame-ancestors).
  { key: "X-Frame-Options", value: "DENY" },
  // Control referrer information.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features not used by this app.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HSTS: enforce HTTPS for 2 years. Railway always serves over HTTPS.
  // In local HTTP dev this header is silently ignored by the browser.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content Security Policy.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js 15 requires unsafe-inline for hydration; use nonce in the future.
      // 'unsafe-eval': lo necesitan webpack en dev (source maps) y reCAPTCHA v3,
      // que lo usa internamente para su scoring (sin él, el CSP lo bloquea y
      // degrada la protección). google.com + gstatic.com: script de reCAPTCHA (item 9).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
      // Tailwind v4 and shadcn/ui inject inline styles.
      "style-src 'self' 'unsafe-inline'",
      // Avatars or inline data URIs from shadcn/ui components.
      "img-src 'self' data: blob:",
      "font-src 'self'",
      // Sentry SDK sends error events to ingest.sentry.io; reCAPTCHA valida en google.com.
      // gstatic.com: reCAPTCHA v3 carga su recurso de idioma (p. ej.
      // recaptcha__en.js) con fetch(), lo que cae bajo connect-src (no
      // script-src). Sin esto, el fetch se bloquea en silencio y
      // `grecaptcha.ready()` nunca llama a su callback — el formulario que
      // pide el token de captcha (registro, recuperar contraseña) se queda
      // colgado para siempre. Reproducido en Android/iOS reales; no se veía
      // en escritorio porque ese código de idioma no se disparaba ahí.
      "connect-src 'self' *.sentry.io https://www.google.com https://www.gstatic.com",
      // Serwist service worker.
      "worker-src 'self'",
      // Disallow plugins (Flash, etc.).
      "object-src 'none'",
      // Prevent base tag injection.
      "base-uri 'self'",
      // Form submissions only to self.
      "form-action 'self'",
      // reCAPTCHA v3 renderiza su badge/desafío en un iframe de google.com.
      "frame-src 'self' https://www.google.com",
      // No embedding in iframes.
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const PRECACHE_REVISION = process.env.RAILWAY_GIT_COMMIT_SHA ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Service worker only in production; in dev it would interfere with HMR.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  // La página /offline es el respaldo de navegación sin red (F9.B1/D-35). Las
  // páginas del App Router no entran solas al precache, así que sin esto el
  // fallback nunca encontraba la página. La revisión cambia en cada build.
  // El logo de esa pantalla también, porque public/ no entra solo al precache.
  additionalPrecacheEntries: [
    { url: "/offline", revision: PRECACHE_REVISION },
    { url: "/icons/icon-512.png", revision: PRECACHE_REVISION },
  ],
});

/**
 * Sentry build-time configuration (F10.B2).
 * - Uploads source maps to Sentry when SENTRY_AUTH_TOKEN is set (production CI).
 * - If the token is absent (local dev, PRs), source maps are NOT uploaded and
 *   the build succeeds normally.
 */
export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG ?? "catapp",
  project: process.env.SENTRY_PROJECT ?? "catapp-nextjs",

  // Upload source maps only when auth token is present.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry CLI output in CI logs.
  silent: !process.env.CI,

  // Don't add Sentry performance instrumentation automatically (manual control).
  autoInstrumentServerFunctions: false,

  // Disable the Sentry logger to reduce bundle size.
  disableLogger: true,

  // Tunnel Sentry requests through the app to avoid ad-blockers (optional).
  // tunnelRoute: "/monitoring",
});
