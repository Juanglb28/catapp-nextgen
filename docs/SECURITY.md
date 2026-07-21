# Seguridad — CatApp (F10.B1)

> Auditoría de seguridad completa. Última revisión: 2026-07-20 (B3: seguridad de 2ª capa).
> Cubre: endpoints, headers, rate limiting, tokens públicos, secretos y OWASP Top 10.

---

## 1. Auditoría de endpoints

### 1.1 Server Actions

Patrón obligatorio: **sesión activa → `requireTenant()` → validación Zod → repositorio con `tenantId`**.

| Server Action                                            | Sesión                 | Tenant               | Zod                            | Estado                     |
| -------------------------------------------------------- | ---------------------- | -------------------- | ------------------------------ | -------------------------- |
| `clients/actions.ts` — createClientAction                | ✅ requireTenant       | ✅ tenantId          | ✅ clientFormSchema            | ✅                         |
| `clients/actions.ts` — updateClientAction                | ✅                     | ✅                   | ✅                             | ✅                         |
| `clients/actions.ts` — archiveClientAction               | ✅                     | ✅                   | N/A (solo ID)                  | ✅                         |
| `clients/actions.ts` — restoreClientAction               | ✅                     | ✅                   | N/A                            | ✅                         |
| `clients/actions.ts` — setClientOptOutAction             | ✅                     | ✅                   | N/A                            | ✅                         |
| `appointments/actions.ts` — createAppointmentAction      | ✅                     | ✅                   | ✅ createAppointmentFormSchema | ✅                         |
| `appointments/actions.ts` — editAppointmentAction        | ✅                     | ✅                   | ✅ editAppointmentSchema       | ✅                         |
| `appointments/actions.ts` — registerPaymentAction        | ✅                     | ✅                   | ✅ registerPaymentSchema       | ✅                         |
| `appointments/actions.ts` — setAppointmentStatusAction   | ✅                     | ✅                   | ✅ setStatusSchema             | ✅                         |
| `inventory/actions.ts` — createProductAction             | ✅                     | ✅                   | ✅ productFormSchema           | ✅                         |
| `inventory/actions.ts` — updateProductAction             | ✅                     | ✅                   | ✅                             | ✅                         |
| `inventory/actions.ts` — deactivateProductAction         | ✅                     | ✅                   | N/A                            | ✅                         |
| `inventory/actions.ts` — registerMovementAction          | ✅                     | ✅                   | ✅ movementFormSchema          | ✅                         |
| `inventory/actions.ts` — adjustStockAction               | ✅                     | ✅                   | ✅ adjustFormSchema            | ✅                         |
| `services/actions.ts` — createServiceAction              | ✅                     | ✅                   | ✅ serviceFormSchema           | ✅                         |
| `services/actions.ts` — updateServiceAction              | ✅                     | ✅                   | ✅                             | ✅                         |
| `services/actions.ts` — deactivate/activateServiceAction | ✅                     | ✅                   | N/A                            | ✅                         |
| `tenancy/actions.ts` — createTenant (onboarding)         | ✅ auth.api.getSession | ❌ N/A (crea tenant) | ✅ onboardingSchema            | ✅ (pre-tenant por diseño) |
| `tenancy/actions.ts` — updateBusinessPublicInfoAction    | ✅                     | ✅                   | ✅ publicInfoSchema            | ✅                         |
| `tenancy/actions.ts` — setAutoMessagesAction             | ✅                     | ✅                   | N/A (boolean)                  | ✅ (TS tipado)             |
| `calendar/actions.ts` — updateCalendarSettingsAction     | ✅                     | ✅                   | ✅ settingsSchema              | ✅                         |
| `calendar/actions.ts` — disconnectGoogleAction           | ✅                     | ✅                   | N/A                            | ✅                         |
| `calendar/actions.ts` — backfillCalendarAction           | ✅                     | ✅                   | N/A                            | ✅                         |
| `calendar/actions.ts` — retrySyncAction                  | ✅                     | ✅                   | N/A (ID string)                | ✅                         |
| `whatsapp/actions.ts` — saveMessageTemplateAction        | ✅                     | ✅                   | ✅ saveTemplateSchema          | ✅                         |

### 1.2 Route Handlers

| Endpoint                                   | Auth                        | Input                   | Estado                      |
| ------------------------------------------ | --------------------------- | ----------------------- | --------------------------- |
| `GET /api/health`                          | ❌ público (intencional)    | N/A                     | ✅                          |
| `GET+POST /api/auth/[...all]`              | Better Auth maneja sesiones | Better Auth valida      | ✅ + rate limiting (ver §2) |
| `POST /api/cron/reminders`                 | ✅ Bearer `CRON_SECRET`     | N/A (no body)           | ✅                          |
| `GET /api/finanzas/export`                 | ✅ requireTenant            | ✅ year/month validados | ✅                          |
| `GET /api/google/connect`                  | ✅ requireTenant            | N/A                     | ✅ + state CSRF             |
| `GET /api/google/callback`                 | ✅ requireTenant            | ✅ CSRF state cookie    | ✅                          |
| `GET /api/whatsapp/webhook` (verificación) | ✅ `WA_VERIFY_TOKEN`        | Params validados        | ✅                          |
| `POST /api/whatsapp/webhook` (estados)     | ✅ HMAC `WA_APP_SECRET`     | Firma verificada        | ✅                          |
| `GET /cita/[token]` (pública)              | ❌ público (D-07)           | UUID regex              | ✅ + rate limiting (ver §2) |
| `GET /cita/[token]/evento.ics`             | ❌ público (D-07)           | UUID regex              | ✅                          |

---

## 2. Rate Limiting (B3.3, antes F10.B1)

Implementación: **store durable en Postgres** (tabla `rate_limits`, ventana fija atómica vía `INSERT … ON CONFLICT`) en `src/modules/rate-limit/repository.ts` (`consumeRateLimit`). Reemplaza el token-bucket en memoria: sobrevive reinicios/redeploys y es correcto con >1 réplica. Fail-open si la DB no responde (defensa secundaria). La IP se resuelve con el **último hop confiable** de `x-forwarded-for` (`getClientIp`, `TRUSTED_PROXY_HOPS`, default 1), no el primer valor —falsificable— (cierra H-03).

| Endpoint                        | Límite            | Clave                | Razón                          |
| ------------------------------- | ----------------- | -------------------- | ------------------------------ |
| `POST /api/auth/sign-in/*`      | 10 req / IP / min | `auth:<ip>`          | Fuerza bruta de contraseñas    |
| `POST /api/auth/sign-up/*`      | 10 req / IP / min | `auth:<ip>`          | Spam de cuentas                |
| `POST /api/security/unlock-password` | 5 req / usuario / min | `applock:<userId>` | Fuerza bruta de la 2ª capa (RG-3) |
| `POST /api/security/disable`    | 5 req / usuario / min | `applock:<userId>` | Fuerza bruta de la 2ª capa (RG-3) |
| `GET /cita/[token]` + acciones  | 30 / 20 req / IP / min | `public-cita:<ip>` / `cita:<ip>` | Enumeración de tokens / spam |
| `POST /api/push/subscribe`      | 30 req / tenant / min | `push:<tenantId>` | Abuso de suscripciones         |

**Multi-instancia:** el store durable ya es correcto con varias réplicas; Redis/Upstash solo si el volumen de escrituras lo exige (ver `DECISIONES.md`).

---

## 3. Headers de seguridad

Configurados en `next.config.ts` (aplican a todas las rutas):

| Header                      | Valor                                                  | Efecto                                                    |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                              | Previene MIME sniffing                                    |
| `X-Frame-Options`           | `DENY`                                                 | Previene clickjacking (fallback para navegadores sin CSP) |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                      | Limita información de referrer                            |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), payment=()` | Deshabilita APIs no usadas                                |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`         | Fuerza HTTPS por 2 años                                   |
| `Content-Security-Policy`   | ver abajo                                              | Controla orígenes de recursos                             |

**CSP:**

```
default-src 'self'
script-src 'self' 'unsafe-inline'     ← Next.js 15 requiere esto para hidratación
style-src 'self' 'unsafe-inline'      ← Tailwind v4 genera estilos inline
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'                    ← AJAX/fetch solo al propio origen
worker-src 'self'                     ← Service worker (Serwist)
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'               ← equivalente a X-Frame-Options DENY
```

> **Deuda técnica**: `'unsafe-inline'` en `script-src` debilita la protección XSS.
> La solución completa es un CSP basado en nonces (Next.js 15 lo soporta con
> `headers()` y `generateNonce()`). Pendiente para cuando se pueda planificar.

---

## 4. Tokens públicos de citas

- `public_token` se genera con `gen_random_uuid()` (PostgreSQL) → UUID v4, 122 bits de entropía.
- Antes de consultar la BD se valida con `UUID_RE` (`/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i`).
- Respuesta para token inexistente y para cita cancelada: **idéntico componente `<Unavailable />`** con HTTP 200 — no hay fuga de información sobre existencia.
- La enumeración es computacionalmente inviable (2^122 combinaciones) y está adicionalmente limitada por rate limit (30 req/min/IP).

---

## 5. Gestión de secretos

- Ningún secreto hardcodeado encontrado (`grep` sobre todo el repo, ver resultados en audit de F10.B1).
- `.env` nunca commiteado (verificado con `git log --all -- ".env"`).
- `.gitignore` cubre `.env*` (excepto `.env.example` que es público por diseño).
- Secretos en producción: variables de entorno en Railway (no expuestas en el código ni en logs).
- `GOOGLE_TOKEN_KEY` cifra el refresh token de Google con AES-256-GCM antes de persistir en BD.

---

## 6. Dependencias

- **Dependabot** activado en `.github/dependabot.yml` (weekly, agrupa minor+patch, las major son manuales).
- `pnpm audit --audit-level=high` añadido al job `quality` de CI — falla el build si hay vulnerabilidades altas o críticas.
- Para correr manualmente: `pnpm audit`.

---

## 7. OWASP Top 10 (2021)

| #   | Categoría                     | Estado en CatApp                                                                                                                                                                                              |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | **Broken Access Control**     | ✅ `requireTenant()` en TODAS las Server Actions y rutas protegidas; `tenantId` obligatorio en repositorios (regla ESLint); middleware protege rutas `(app)/`; tests de aislamiento A/B (F1.B4).              |
| A02 | **Cryptographic Failures**    | ✅ Refresh tokens de Google cifrados con AES-256-GCM (`src/lib/crypto.ts`). Contraseñas gestionadas por Better Auth (bcrypt). HTTPS en producción (Railway + HSTS). `DATABASE_URL` y secretos solo en env.    |
| A03 | **Injection**                 | ✅ Drizzle ORM con queries parametrizadas — sin SQL directo. Inputs validados con Zod antes de llegar a la BD. El único `sql.raw()` es para el literal de timezone (valor hardcodeado, no input de usuario).  |
| A04 | **Insecure Design**           | ✅ Multi-tenant by design desde F1; precios congelados (D-10); stock solo vía movimientos (D-09); página pública no expone precios ni teléfono de la clienta (D-07); mutaciones offline no se encolan (D-12). |
| A05 | **Security Misconfiguration** | ✅ Security headers en `next.config.ts`; `CRON_SECRET` protege el cron; `WA_APP_SECRET` valida la firma del webhook; sin dependencias con vulnerabilidades altas (audit en CI).                               |
| A06 | **Vulnerable Components**     | ✅ Dependabot activado; `pnpm audit` en CI (falla en severidad alta/crítica).                                                                                                                                 |
| A07 | **Auth & Session Failures**   | ✅ Better Auth con sesiones en BD; middleware redirige sin sesión; rate limiting en sign-in/sign-up (10 req/IP/min); CSRF en OAuth de Google (state cookie httpOnly).                                         |
| A08 | **Integrity Failures**        | ✅ Migraciones versionadas con Drizzle Kit (no se editan las aplicadas); `pnpm --frozen-lockfile` en CI; sin deserialización de objetos de usuarios externos.                                                 |
| A09 | **Logging & Monitoring**      | ⚠️ Logging básico (console). Sentry y logging estructurado pendientes en F10.B2. Railway proporciona logs de la app y métricas básicas.                                                                       |
| A10 | **SSRF**                      | ✅ Las únicas llamadas salientes son a Google Calendar API y Meta Graph API — ambas desde código del servidor con URLs hardcodeadas, nunca construidas desde input de usuario.                                |

---

## 8. Pendientes / Deuda técnica aceptada

| Item                                                       | Severidad | Plazo            |
| ---------------------------------------------------------- | --------- | ---------------- |
| CSP nonce-based (eliminar `'unsafe-inline'` en script-src) | Media     | Post-lanzamiento |
| Rate limiting con Redis (solo si el volumen lo exige; el store durable en Postgres ya cubre multi-instancia) | Baja | Al escalar |
| Sentry + logging estructurado                              | Media     | F10.B2           |
| ~~Email verification en registro~~ **Hecho (B3.2)**: activa con `RESEND_API_KEY`. | — | ✅ |
| Rotación de `BETTER_AUTH_SECRET` antes del lanzamiento     | Alta      | F10.B3           |

### Resuelto en B3 (2026-07-20)

- **Rate limiting durable + cobertura (B3.3, H-03):** store en Postgres, IP de confianza, cobertura en auth/app-lock/cita/push.
- **App-lock anti-fuerza-bruta (B3.1, RG-3):** 5 intentos/min en `unlock-password` y `disable`.
- **Secreto de app-lock fail-fast (B3.1, RG-4):** sin `APP_LOCK_SECRET`/`BETTER_AUTH_SECRET` en producción, no se firman cookies (no forjables).
- **Email verification + linking estricto (B3.2, RG-5/H-04):** activos con Resend; el registro exige confirmar el correo y el linking de Google solo procede con email verificado.
