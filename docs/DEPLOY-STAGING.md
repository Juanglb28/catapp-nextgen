# Despliegue y staging — CatApp-NextGen

Guía para llevar **CatApp-NextGen** (esta versión modernizada) a Railway,
primero a un entorno de **staging** para probar, y después el **cutover** a
producción sin perder los datos de la app anterior.

Para los pasos detallados de cada servicio externo (crear credenciales de Google,
webhook de WhatsApp, dominio propio) usa `docs/DEPLOY.md`, que sigue vigente.
Este documento se centra en la estrategia staging → producción y en lo que
cambió respecto a la versión anterior.

---

## 1. Panorama

- **CatApp (anterior)**: la app que ya tienes desplegada en Railway (producción).
  Su repo/carpeta es **inmutable**: no la tocamos.
- **CatApp-NextGen (esta)**: fork de CatApp modernizado (B0–B5 + UX). Comparte la
  historia de migraciones con la anterior **hasta la 0024**; añade **0025, 0026
  y 0027** (nada más diverge). Es decir, el "upgrade" de la base de datos es
  aplicar esas 3 migraciones sobre el esquema de producción.

**Estrategia recomendada (bajo riesgo):**

```
1. Respaldo de la DB de producción (pg_dump)        ← red de seguridad
2. Respaldo del código en GitHub (rama nueva)
3. Staging: servicio NUEVO + DB NUEVA (restaurada del backup de prod)
4. Deploy de NextGen a staging → corre migraciones 0025–0027 sobre datos reales
5. Pruebas en staging
6. Cutover a producción (backup + migraciones + deploy), con plan de rollback
```

**Sobre la DB (aclara D-21 "misma DB de Railway"):** esa decisión aplica al
**cutover final** — NextGen reemplaza a la app anterior usando la MISMA base de
producción, después de migrarla. Para **staging NO se usa la DB de producción**:
se usa una base separada (una copia restaurada), así las pruebas y las
migraciones nunca tocan los datos reales.

---

## 2. Paso 0 — Respaldo de la base de datos de producción

> ⚠️ **Antes de correr CUALQUIER comando contra una connection string** (`pg_dump`,
> y sobre todo `pg_restore`/`psql` con algo destructivo), verificá primero con una
> consulta de solo lectura que estás apuntando al entorno correcto:
>
> ```bash
> psql "postgresql://...URL..." -c "SELECT current_database();"
> ```
>
> Producción y staging viven en **proyectos distintos de Railway** con host y
> puerto de proxy **distintos** (ej. producción en el puerto `13358`, staging en
> el `41493` — los tuyos van a ser otros, pero nunca coinciden entre entornos).
> Es fácil reutilizar por error la connection string que tenías copiada de un
> paso anterior (pasó durante el cutover del 2026-07-29: se restauró producción
> sobre sí misma por reusar su propia connection string pensando que era la de
> staging — sin daño porque no hubo escrituras en la ventana, pero pudo no serlo).
> Cada vez que cambies de entorno, andá de nuevo a Railway → el proyecto correcto
> → servicio Postgres → pestaña **Connect**, no reuses una URL de un mensaje
> anterior sin volver a mirar de qué proyecto salió.

Es de **solo lectura** (`pg_dump` no modifica nada). Hazlo antes de cualquier
cosa. Necesitas la connection string pública de tu Postgres de producción en
Railway (servicio Postgres → pestaña **Connect** → "Postgres Connection URL").

Requisito: un cliente de Postgres cuya versión sea **igual o mayor** a la del
servidor (si tu Postgres en Railway es 17, usa `pg_dump` 17). En Windows viene
con la instalación de PostgreSQL, o úsalo vía Docker (abajo).

```bash
# Formato custom comprimido (recomendado; se restaura con pg_restore):
pg_dump "postgresql://USER:PASS@HOST:PORT/DB" -Fc -f catapp-prod-YYYYMMDD.dump

# Alternativa en SQL plano (legible, más grande):
pg_dump "postgresql://USER:PASS@HOST:PORT/DB" -f catapp-prod-YYYYMMDD.sql
```

Si no tienes `pg_dump` local, con Docker (usa la imagen de la MISMA versión que
tu servidor, aquí 17):

```bash
docker run --rm -v "${PWD}:/backup" postgres:17 \
  pg_dump "postgresql://USER:PASS@HOST:PORT/DB" -Fc -f /backup/catapp-prod-YYYYMMDD.dump
```

Verifica que el archivo pesa algo razonable y guárdalo **fuera** de Railway (tu
disco + una copia en la nube). Prueba que es restaurable (ver Paso 3).

> Railway ofrece backups automáticos del plugin de Postgres; aun así, un
> `pg_dump` manual off-platform antes de un cambio grande es la mejor red.

---

## 3. Paso 1 — Respaldo del código en GitHub (rama nueva)

Ya dejé una rama local de respaldo: **`respaldo/nextgen-20260723`** (apunta al
último commit). Falta subir el repo a GitHub (no tengo tus credenciales, así que
esto lo corres tú):

```bash
# 1) Crea un repo VACÍO en GitHub (sin README), p. ej. "catapp-nextgen" (privado).
# 2) Conecta el remoto y sube main + la rama de respaldo:
cd D:\Trabajo\CatApp-NextGen
git remote add origin https://github.com/<tu-usuario>/catapp-nextgen.git
git push -u origin main
git push origin respaldo/nextgen-20260723
```

Si prefieres, crea la rama de respaldo desde main en cualquier momento con
`git branch respaldo/nextgen-<fecha> main && git push origin respaldo/...`.

> Recordatorio de seguridad: **nunca** subas `.env` (está en `.gitignore`). Los
> secretos van en `.env` local y en las variables de Railway, jamás en archivos
> versionados como `.env.example`.

---

## 4. Paso 2 — Crear el entorno de STAGING en Railway

### 4.1 Base de datos de staging

1. En tu proyecto de Railway, añade un **nuevo servicio PostgreSQL** (será la DB
   de staging, separada de la de producción). Usa la misma versión mayor que
   producción.
2. **Restaura** el backup de producción en esa base nueva. **Antes de este
   comando**, corré la verificación de entorno de la Fase 0 contra ESTA connection
   string (la de staging) — confirmá que `current_database()` responde y que los
   counts de tenants/clients/appointments son los de **staging** (probablemente
   distintos a los de producción), no reutilices la URL de producción del paso
   anterior:

```bash
# Formato custom (.dump):
pg_restore -d "postgresql://...STAGING..." --no-owner --no-privileges catapp-prod-YYYYMMDD.dump
# SQL plano (.sql):
psql "postgresql://...STAGING..." -f catapp-prod-YYYYMMDD.sql
```

Ahora staging tiene una copia de los datos reales, en el esquema **0024** (igual
que producción). Las migraciones de NextGen lo llevarán a 0027 en el deploy.

> Alternativa más simple (sin datos reales): deja la DB de staging vacía; el
> deploy correrá TODAS las migraciones desde cero y tendrás una app limpia para
> smoke-tests. Pierdes probar la migración sobre datos reales, que es justo lo
> valioso — por eso se recomienda restaurar el backup.

### 4.2 Servicio de la app de staging

1. Añade un **nuevo servicio** apuntando al repo de GitHub (rama `main`), o a un
   entorno "staging" separado. El `Dockerfile` y `railway.toml` ya están en el
   repo:
   - `preDeployCommand = pnpm db:migrate` → aplica migraciones **antes** de
     arrancar (así 0025–0027 corren solas en el primer deploy).
   - `startCommand = pnpm start`, healthcheck en `/api/health`.
   - Dos crons ya definidos: cumpleaños (11:00 UTC) y recordatorio-mañana (01:00
     UTC). Si usas WhatsApp, añade también el cron horario de `/api/cron/reminders`.
2. Conecta la variable `DATABASE_URL` de este servicio a la **DB de staging**
   (no a la de producción).

### 4.3 Variables de entorno (ver tabla en la sección 7)

Configúralas en el servicio de staging. **Ojo con las `NEXT_PUBLIC_*`**: Next.js
las incrusta en el bundle **durante el build**, así que deben existir en Railway
**antes** de compilar (no basta con ponerlas después). Aplica a
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `NEXT_PUBLIC_SENTRY_DSN`.

Mínimas para que staging arranque: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL` (la URL pública de staging que te da Railway, p. ej.
`https://catapp-staging.up.railway.app`).

---

## 5. Paso 3 — Configurar los servicios externos para staging

Staging tiene su **propia URL**, así que varios servicios necesitan entradas
separadas (no reutilices las de producción a ciegas). Detalle paso a paso en
`docs/DEPLOY.md`; aquí el resumen de qué ajustar:

- **Google OAuth (login + Calendar):** en Google Cloud Console → Credentials,
  agrega a la MISMA credencial (o crea una para staging):
  - Authorized JavaScript origins: `https://<staging>.up.railway.app`
  - Authorized redirect URIs: `https://<staging>.up.railway.app/api/auth/callback/google`
    Pon `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en staging. Para Calendar,
    genera un `GOOGLE_TOKEN_KEY` (`openssl rand -base64 32`) **propio de staging**
    (distinto al de prod: cifra los refresh_token con AES).
- **Resend (correos de verificación y reset):** en modo prueba (sin dominio
  verificado) solo envía desde `onboarding@resend.dev` y hacia tu propio correo
  de Resend — suficiente para probar. Para envío real, verifica un dominio y usa
  `RESEND_FROM_EMAIL="CatApp <no-reply@tudominio>"`. **Con `RESEND_API_KEY`
  puesta se activa la verificación de email** (los registros nuevos deben
  confirmar el correo).
- **VAPID (push):** genera un par con `npx web-push generate-vapid-keys` y pon
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Recuerda: las 3 del servidor van juntas o
  ninguna (validación todo-o-nada al arranque, B3.3).
- **WhatsApp (opcional):** si no lo pruebas en staging, deja las `WA_*` vacías y
  el módulo queda inerte. Si lo pruebas, ver `docs/DEPLOY.md` (webhook con la URL
  de staging).
- **CRON_SECRET:** genera uno (`openssl rand -base64 32`) para proteger los crons.
- **TRUSTED_PROXY_HOPS:** `1` (Railway pone un proxy delante).
- **Sentry (opcional):** DSN si quieres monitoreo en staging.

---

## 6. Paso 4 — Deploy, migraciones y verificación en staging

1. Dispara el deploy (push a `main` o "Deploy" en Railway). El build compila con
   las `NEXT_PUBLIC_*`, luego `preDeployCommand` corre `pnpm db:migrate` →
   **aplica 0025, 0026, 0027** sobre la DB de staging (la copia de prod pasa de
   0024 a 0027). Revisa los logs del deploy: las migraciones deben terminar sin
   error antes de que arranque la app.
2. Verifica salud: `https://<staging>.up.railway.app/api/health` →
   `{ "ok": true, "db": true }`.
3. Smoke-tests con los datos reales restaurados:
   - Login (email y Google), registro con verificación de correo.
   - Agenda, crear/editar cita, registrar pago, finanzas.
   - Cumpleaños/bonos, recordatorios, push (si configuraste VAPID).
   - Cambio de paleta (Ajustes → Apariencia) y modo claro/oscuro.
   - App-lock (Finanzas/Ajustes) si lo usas.
4. Si algo falla en las migraciones sobre datos reales (p. ej. el retiro del rol
   staff en 0025 con datos antiguos), aquí es donde se detecta — sin tocar
   producción. Ajustamos y repetimos restaurando el backup otra vez.

---

## 7. Variables de entorno (referencia completa)

Fuente: `.env.example`. **Req.** = obligatoria para arrancar en producción.

| Variable                                                                       | Req. | Para qué / dónde se obtiene                                                                              |
| ------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                 | ✅   | Postgres del servicio (Railway la inyecta). En staging, la DB de staging.                                |
| `BETTER_AUTH_SECRET`                                                           | ✅   | `openssl rand -base64 32`. Firma sesiones y cookies. **Distinto por entorno.**                           |
| `BETTER_AUTH_URL`                                                              | ✅   | URL pública del entorno (`https://…`).                                                                   |
| `APP_LOCK_SECRET`                                                              | —    | Opcional; clave dedicada del app-lock. Si falta, usa `BETTER_AUTH_SECRET`.                               |
| `BETTER_AUTH_TRUSTED_ORIGINS`                                                  | —    | Orígenes extra (CSV, sin espacios). Normalmente no hace falta si entras por la URL de `BETTER_AUTH_URL`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                    | —    | Login con Google + Calendar. Google Cloud Console.                                                       |
| `GOOGLE_TOKEN_KEY`                                                             | —    | `openssl rand -base64 32`. Cifra refresh_token de Google. **Distinto por entorno.**                      |
| `RESEND_API_KEY`                                                               | —    | Correos (verificación/reset). Con ella se ACTIVA la verificación de email. resend.com/api-keys.          |
| `RESEND_FROM_EMAIL`                                                            | —    | Remitente. En prueba: `onboarding@resend.dev`.                                                           |
| `TRUSTED_PROXY_HOPS`                                                           | —    | `1` en Railway. Resuelve la IP real (rate-limit).                                                        |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`                     | —    | Push. `npx web-push generate-vapid-keys`. Las 3 juntas o ninguna.                                        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                                                 | —    | Igual a `VAPID_PUBLIC_KEY`. **Se incrusta en build.**                                                    |
| `WA_PHONE_NUMBER_ID` / `WA_ACCESS_TOKEN` / `WA_VERIFY_TOKEN` / `WA_APP_SECRET` | —    | WhatsApp Cloud API (Meta). Vacías = módulo inerte.                                                       |
| `WA_TEMPLATE_REMINDER` / `WA_TEMPLATE_CONFIRMATION`                            | —    | Nombres de plantillas aprobadas (opcional).                                                              |
| `CRON_SECRET`                                                                  | —    | Protege los crons. `openssl rand -base64 32`.                                                            |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`                                        | —    | Monitoreo de errores. **La pública se incrusta en build.**                                               |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`                          | —    | Subida de source maps en CI (no en local).                                                               |
| `LOG_LEVEL`                                                                    | —    | `debug`\|`info`\|`warn`\|`error`. Default `info`.                                                        |
| `DB_POOL_MAX`                                                                  | —    | Máx. conexiones del pool. Default 20.                                                                    |
| `TEST_DATABASE_URL` / `E2E_*`                                                  | —    | Solo para tests; no en producción.                                                                       |

---

## 8. Paso 5 — Cutover a producción (cuando staging esté validado)

1. **Ventana de mantenimiento** breve (idealmente con poco tráfico).
2. **Backup fresco de producción** (repite el Paso 0). Imprescindible.
3. Apunta el servicio de producción (o uno nuevo) al repo de NextGen, con
   `DATABASE_URL` = **la base de producción** (aquí sí aplica D-21: misma DB).
4. Deploy: `preDeployCommand` corre `pnpm db:migrate` → aplica 0025–0027 a
   producción (esquema 0024 → 0027). Revisa los logs: si las migraciones fallan,
   la app **no** arranca (fail-safe) y no se sirve una versión rota.
5. Actualiza en los servicios externos las URLs de producción (redirect URIs de
   Google, webhook de WhatsApp) si cambió el dominio.
6. Verifica `/api/health` y un smoke-test rápido.

**Rollback si algo sale mal:**

- Si el deploy falla en migraciones, no llega a servir; corrige y reintenta.
- Si ya migró pero hay un problema grave: **restaura el backup fresco** del Paso
  8.2 en la DB de producción (`pg_restore`) y vuelve a desplegar la app anterior
  (que sigue intacta en su repo). Por eso el backup previo es la red clave.
- Ten a mano la connection string y el `.dump` antes de empezar el cutover.

---

## 9. Checklist rápido

- [ ] `pg_dump` de producción hecho y verificado (restaurable).
- [ ] Código respaldado en GitHub (main + rama `respaldo/…`).
- [ ] DB de staging creada y restaurada desde el backup.
- [ ] Variables de entorno de staging puestas (incl. `NEXT_PUBLIC_*` antes del build).
- [ ] Servicios externos con las URLs de staging (Google, Resend, VAPID).
- [ ] Deploy a staging OK; migraciones 0025–0027 sin error; `/api/health` verde.
- [ ] Smoke-tests en staging con datos reales.
- [ ] (Cutover) Backup fresco de prod → deploy a prod → verificación → rollback listo.
