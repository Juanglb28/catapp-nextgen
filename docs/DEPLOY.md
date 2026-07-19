# Despliegue — CatApp

Guía paso a paso para dejar CatApp en producción en **Railway**, con CI en **GitHub Actions**.
Estos pasos los hace una persona (Susana/Juan) una sola vez; luego cada push a `main` despliega solo.

## 0. Prerrequisitos

- Cuenta en [GitHub](https://github.com) y en [Railway](https://railway.app).
- El proyecto compila en local: `pnpm install && pnpm build` sin errores.

## 1. Subir el código a GitHub

1. Crea un repositorio nuevo en GitHub (vacío, sin README).
2. En la carpeta del proyecto, conecta el remoto y sube `main`:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/catapp.git
   git push -u origin main
   ```

3. Al hacer push, **GitHub Actions** corre solo (`.github/workflows/ci.yml`):
   instala, lint, typecheck, test y build con Node 22. Debe quedar en verde ✅.

## 2. Crear el proyecto en Railway

1. En Railway: **New Project → Deploy from GitHub repo** y elige el repo `catapp`.
   (Autoriza el acceso de Railway a GitHub si te lo pide.)
2. Railway detecta Node + pnpm (campo `packageManager`) y usa `railway.json` para:
   - **build:** `pnpm build`
   - **preDeploy:** `pnpm db:migrate` (aplica las migraciones antes de levantar la nueva versión)
   - **start:** `pnpm start`
   - **healthcheck:** `/api/health`

## 3. Añadir PostgreSQL

1. Dentro del proyecto en Railway: **New → Database → Add PostgreSQL**.
2. Esto crea un servicio Postgres que expone una variable `DATABASE_URL`.

## 4. Variables de entorno (servicio de la app)

En el servicio de la app → pestaña **Variables**, añade:

| Variable             | Valor                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Referencia al Postgres: `${{ Postgres.DATABASE_URL }}` (Railway la inyecta)     |
| `BETTER_AUTH_SECRET` | Genera uno con `openssl rand -base64 32` (F1 lo usará)                          |
| `BETTER_AUTH_URL`    | El dominio público de la app, p. ej. `https://catapp-production.up.railway.app` |

> Nota: el nombre exacto de la referencia (`Postgres`) depende de cómo se llame tu servicio
> de base de datos en Railway. Usa el selector de variables de Railway para insertarlo.

Las variables de fases siguientes (Google OAuth en F1/F5, WhatsApp en F8, Sentry en F10)
se añaden cuando llegue cada fase; la lista completa está en el Apéndice C del plan y en `.env.example`.

## 5. Dominio y deploy automático

1. En el servicio de la app → **Settings → Networking → Generate Domain** para obtener la URL pública (HTTPS).
2. Copia esa URL en `BETTER_AUTH_URL` (paso 4) y vuelve a desplegar.
3. El **deploy automático desde `main`** ya está activo por defecto: cada push a `main` que pase CI
   dispara un nuevo despliegue. (Opcional: en Railway puedes exigir que CI esté en verde antes de desplegar.)

## 6. Verificación

- Abre `https://<tu-dominio>/api/health` → debe responder `{ "ok": true, "db": true }`.
- Abre la raíz `https://<tu-dominio>/` → redirige a `/citas` y se ve la navegación.
- En Chrome Android / Safari iOS, instala la PWA ("Agregar a pantalla principal"): el dominio HTTPS
  permite registrar el service worker y debe aparecer el ícono "CA".
- GitHub Actions en verde en la pestaña **Actions** del repo.

## Operación

- **Migraciones:** se aplican solas en cada deploy vía `preDeployCommand` (`pnpm db:migrate`).
  Nunca edites una migración ya aplicada; crea una nueva con `pnpm db:generate`.
- **Rollback:** en Railway → pestaña **Deployments**, puedes redeployar una versión anterior.
- **Logs:** Railway → servicio de la app → **Deploy Logs / Observability**.
- **Backups de Postgres:** se configuran en F10 (ver `docs/RUNBOOK.md` cuando exista).

## Autenticación: variables y Google OAuth (F1)

Desde F1, la app usa **Better Auth**. Para producción, en las Variables del servicio:

- `BETTER_AUTH_SECRET` — obligatorio. Genera uno con `openssl rand -base64 32`.
- `BETTER_AUTH_URL` — el dominio público (p. ej. `https://catapp-production.up.railway.app`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — opcionales (solo si quieres el login con Google).

> Sin `GOOGLE_CLIENT_ID`/`SECRET`, el login por correo+contraseña funciona igual; el
> botón "Continuar con Google" simplemente no estará operativo hasta configurarlos.

### Crear credenciales de Google (login F1, se reutiliza en Calendar F5)

1. Entra a [Google Cloud Console](https://console.cloud.google.com) y crea (o elige) un **proyecto**.
2. **APIs & Services → OAuth consent screen**: tipo **External**, completa nombre de la app,
   correo de soporte y guarda. Agrega tu correo como **Test user** mientras esté en modo Testing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:3000` y tu dominio de Railway.
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<tu-dominio>/api/auth/callback/google`
4. Copia el **Client ID** y **Client Secret** a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   (en tu `.env` local y en las Variables de Railway).
5. En **F5** reutilizarás este mismo proyecto: bastará con habilitar la **Google Calendar API**
   y añadir el scope `calendar.events`.

> La verificación de correo (email verification) queda **desactivada** por ahora
> (deuda técnica registrada en `docs/DECISIONES.md`).

## Google Calendar (F5)

A partir de **F5.B1**, cada manicurista puede conectar su propia cuenta de Google
para que sus citas se sincronicen con su calendario. La conexión se hace en la app
(**Ajustes → Google Calendar**), no en el login; usa el mismo proyecto de Google Cloud
de F1 pero con su **propio** `redirect_uri` y un scope distinto.

### 1. Configurar Google Cloud (una sola vez)

En el **mismo proyecto** de Google Cloud de F1:

1. **APIs & Services → Library → Google Calendar API → Enable.**
2. **APIs & Services → Credentials →** abre el **OAuth client ID** Web que ya creaste en F1
   y, en **Authorized redirect URIs**, **añade** (sin quitar los de login):
   - `http://localhost:3000/api/google/callback`
   - `https://<tu-dominio>/api/google/callback` (p. ej. `https://catapp-production.up.railway.app/api/google/callback`)
3. **OAuth consent screen → Scopes:** asegúrate de que esté disponible el scope
   `https://www.googleapis.com/auth/calendar.events` (la app también pide `openid` y `email`
   para identificar el correo conectado). Mientras la pantalla esté en **Testing**, agrega como
   **Test users** los correos de Google que vayan a conectarse.

> Se reutilizan `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` de F1. No hace falta un cliente nuevo;
> solo añadir el redirect URI de Calendar y habilitar la API.

### 2. Variable nueva: `GOOGLE_TOKEN_KEY`

El `refresh_token` de cada cuenta se guarda **cifrado** (AES-256-GCM) en la base de datos.
La clave de cifrado viene de `GOOGLE_TOKEN_KEY`:

| Variable           | Valor                                                        |
| ------------------ | ------------------------------------------------------------ |
| `GOOGLE_TOKEN_KEY` | Secreto aleatorio. Genera uno con `openssl rand -base64 32`. |

- Ponla en tu `.env` local **y** en las Variables del servicio en Railway.
- **No la rotes a la ligera:** si cambia, los `refresh_token` ya guardados dejan de poder
  descifrarse y cada manicurista tendrá que **reconectar** su cuenta (en Ajustes → Google Calendar).
- Es independiente de `BETTER_AUTH_SECRET`; no las mezcles.

### 3. Verificación

1. Con `GOOGLE_CLIENT_ID/SECRET` y `GOOGLE_TOKEN_KEY` configuradas, entra a **Ajustes → Google Calendar**.
2. **Conectar con Google** → consentimiento → vuelve a `/ajustes/calendario?google=connected`.
3. Debe mostrar el correo conectado, el selector de calendario destino y el toggle de sync.
4. **Desconectar** revoca el acceso contra Google y borra la fila local (las citas en CatApp no se borran).

> Si una cuenta aparece como **rota** ("se perdió el acceso"), es que Google revocó el `refresh_token`
> (contraseña cambiada, acceso retirado, etc.); basta con **Reconectar**.

## Importación de contactos de Google (módulo Clientas)

Desde **2026-06-18**, la sección **Clientas → Importar Google** permite traer contactos de Google
directamente como clientas. Usa el mismo proyecto de Google Cloud de F1/F5 pero requiere
habilitar la **People API** y añadir un scope adicional.

### 1. Habilitar la People API

1. Google Cloud Console → **APIs y servicios → Biblioteca**.
2. Busca **"People API"** (también aparece como "Google People API").
3. Haz clic en **Habilitar**. Sin este paso la app recibe un 403 al llamar los contactos.

### 2. Añadir el scope `contacts.readonly`

1. Google Cloud Console → **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Haz clic en **Editar app**.
3. Avanza al paso **Permisos** y haz clic en **"Agregar o quitar permisos"**.
4. En el buscador de permisos escribe `contacts.readonly` y marca:
   `https://www.googleapis.com/auth/contacts.readonly`
5. Guarda y publica los cambios.

> **Si la pantalla de consentimiento está en modo Testing**, añade los correos de Google
> que vayan a importar contactos como **Test users** (mismo lugar donde los añadiste en F1/F5).

### 3. No se necesitan variables de entorno nuevas

El flujo reutiliza `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_TOKEN_KEY`
que ya existían. El único cambio es el scope adicional pedido durante el consentimiento.

### 4. Re-autorización de usuarios existentes

Si una manicurista ya tenía Google conectado (para Calendar), al entrar a
**Clientas → Importar Google** la app lanzará un nuevo flujo OAuth que pide también
`contacts.readonly`. Google mostrará la pantalla de consentimiento con los **dos scopes**
(calendar.events + contacts.readonly) juntos. Debe aceptar para poder importar contactos;
la conexión de Calendar **no se interrumpe** durante el proceso.

### 5. Verificación

1. Entra a **Clientas → Importar Google**.
2. Si Google no está conectado, aparece el botón **"Conectar Google"** → al pulsarlo se
   pide el consentimiento y se vuelve a `/clientas/importar`.
3. Deben aparecer los contactos del usuario (importables en blanco, no importables en gris
   con la razón: "Sin teléfono", "Teléfono no colombiano").
4. Selecciona uno o varios → **Importar** → pantalla de confirmación con el recuento.
5. Las clientas aparecen inmediatamente en la lista de Clientas.

> Si la pantalla muestra **"Autorizar acceso a contactos"** aunque Google ya está conectado,
> significa que el scope `contacts.readonly` no se había pedido en la conexión anterior.
> Basta con pulsar el botón para que la app pida el consentimiento con el scope nuevo.

---

## Dominio propio (opcional, post-lanzamiento inicial)

> El dominio Railway (`catapp-production.up.railway.app`) es suficiente para arrancar.
> Cuando quieras usar tu propio dominio (`catapp.com`, `agenda.sunegocio.co`, etc.),
> sigue estos pasos.

### 1. Apuntar el dominio a Railway

1. En tu proveedor de DNS (GoDaddy, Namecheap, Cloudflare, etc.), crea un registro:
   - **Tipo:** `CNAME`
   - **Nombre / Host:** `@` (raíz) o el subdominio que quieras, p. ej. `www` o `agenda`
   - **Valor / Destino:** el dominio de Railway, p. ej. `catapp-production.up.railway.app`
   - **TTL:** 300 (5 min) mientras pruebas; luego puedes subir a 3600

   > Si tu proveedor no admite CNAME en la raíz, usa un registro **ALIAS** o **ANAME**
   > (Cloudflare lo llama "CNAME flattening"). Si usas Cloudflare, activa el proxy naranja
   > solo si quieres sus CDN/WAF; con proxy activo Railway no puede emitir su propio TLS.

2. En Railway → servicio catapp → **Settings → Networking → Custom Domain**, añade tu dominio.
   Railway emitirá un certificado TLS automáticamente (Let's Encrypt). Puede tardar 1–5 min.

3. Verifica que `https://tudominio.com/api/health` responda `{"ok":true,"db":true}`.

### 2. Actualizar las variables de entorno tras el cambio de dominio

Tras apuntar el dominio, actualiza en Railway → Variables:

| Variable                 | Valor anterior                             | Nuevo valor             |
| ------------------------ | ------------------------------------------ | ----------------------- |
| `BETTER_AUTH_URL`        | `https://catapp-production.up.railway.app` | `https://tudominio.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | (sin cambio)                               | (sin cambio)            |

Haz un nuevo **deploy** para que los cambios tomen efecto.

### 3. Actualizar redirect URIs en Google Cloud

Si usas login con Google o Google Calendar:

1. Google Cloud Console → **APIs & Services → Credentials → tu OAuth Client ID (Web)**.
2. En **Authorized JavaScript origins**, añade `https://tudominio.com`.
3. En **Authorized redirect URIs**, añade:
   - `https://tudominio.com/api/auth/callback/google` (login)
   - `https://tudominio.com/api/google/callback` (Calendar)
4. Guarda. El cambio es inmediato en Google.

### 4. Actualizar el webhook de WhatsApp en Meta

Si usas WhatsApp Cloud API:

1. Meta for Developers → tu app → **WhatsApp → Configuration → Webhook**.
2. Cambia la **Callback URL** a `https://tudominio.com/api/whatsapp/webhook`.
3. Vuelve a verificar el webhook (Meta hará un GET con tu `WA_VERIFY_TOKEN`).

---

## WhatsApp Cloud API (F8)

Desde **F8.B1**, CatApp puede enviar recordatorios automáticos por WhatsApp con la **Cloud API** de
Meta (plantillas aprobadas). Es **opcional**: si las variables están vacías, el módulo queda **inerte**
y la app funciona igual que en F4 (mensajes manuales por `wa.me`).

### 1. Crear la app de WhatsApp en Meta

1. Entra a [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App** (tipo
   "Business") y dentro añade el producto **WhatsApp**.
2. En **WhatsApp → API Setup** verás un **número de prueba** gratuito y el **Phone number ID**. Copia:
   - **Phone number ID** → `WA_PHONE_NUMBER_ID`.
   - **Temporary access token** (o uno permanente de un System User) → `WA_ACCESS_TOKEN`.
3. Agrega tu propio número como **destinatario de prueba** para poder recibir mensajes mientras pruebas.
4. **Plantillas:** en **WhatsApp Manager → Message Templates**, crea y haz aprobar la plantilla de
   recordatorio (idioma `es`) con los parámetros de cuerpo que usará F8.B2. El módulo solo envía
   plantillas; Meta debe aprobarlas antes.

### 2. Variables de entorno

| Variable             | Valor                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| `WA_PHONE_NUMBER_ID` | Phone number ID del paso 1.                                                        |
| `WA_ACCESS_TOKEN`    | Token de acceso (temporal para probar; permanente de System User en producción).   |
| `WA_VERIFY_TOKEN`    | Un secreto que **inventas tú** (cualquier cadena). Se usa al verificar el webhook. |
| `WA_APP_SECRET`      | **App Secret** de Meta (Configuración → Básica). Valida la firma del webhook.      |

Ponlas en tu `.env` local y en las Variables de Railway. Si las dejas vacías, no se envía nada.

### 3. Configurar el webhook (estados de entrega)

1. En **WhatsApp → Configuration → Webhook**, pon como **Callback URL**:
   `https://<tu-dominio>/api/whatsapp/webhook`
2. En **Verify token** pon exactamente el valor de `WA_VERIFY_TOKEN`. Meta hará un GET de verificación
   y la app responderá el `hub.challenge` si coincide.
3. **Subscribe** al campo **`messages`** (incluye los eventos de estado: sent/delivered/read/failed).
4. Cada estado entrante llega firmado con `X-Hub-Signature-256`; la app **valida la firma** con
   `WA_APP_SECRET` y actualiza la tabla `wa_messages`. Si la firma no es válida, responde 401.

### 4. Verificación

- Con todo configurado, un envío de prueba (F8.B2) debe pasar de `queued` → `sent` y luego, por el
  webhook, a `delivered`/`read` en la tabla `wa_messages` (consultable en psql).
- Si un número no tiene WhatsApp o la plantilla no está aprobada, la fila queda `failed` con el motivo
  en la columna `error` (los detalles crudos de Meta no se muestran en la UI).

### 5. Recordatorios automáticos (cron, F8.B2)

La confirmación al **crear** una cita se envía sola (no necesita cron). El **recordatorio** del día
anterior lo dispara un cron que llama al endpoint:

- **Endpoint:** `POST https://<tu-dominio>/api/cron/reminders`
- **Cabecera:** `Authorization: Bearer <CRON_SECRET>` (define `CRON_SECRET` con `openssl rand -base64 32`,
  en `.env` y en Railway).
- Busca citas agendadas que empiezan dentro de **20–28h** sin recordatorio previo y envía la plantilla.
  Es **idempotente**: correrlo cada hora nunca duplica (la marca vive en `wa_messages`).

Ambos envíos respetan el toggle del negocio (**Ajustes → Mensajes automáticos**) y el **opt-out** de
cada clienta (en su ficha).

**Programarlo cada hora** (elige una opción):

- **Railway cron service:** crea un servicio cron en el proyecto con un comando que llame al endpoint,
  p. ej. `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$BETTER_AUTH_URL/api/cron/reminders"`,
  con schedule `0 * * * *`.
- **GitHub Actions (fallback):** un workflow `schedule: - cron: "0 * * * *"` que haga el mismo `curl`
  con los secretos `CRON_SECRET` y la URL en los _repository secrets_. Ejemplo:

  ```yaml
  name: reminders
  on:
    schedule:
      - cron: "0 * * * *"
  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - run: >
            curl -fsS -X POST
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
            "${{ secrets.APP_URL }}/api/cron/reminders"
  ```

> Si WhatsApp no está configurado, el endpoint responde `{ ok: true, skipped: "not_configured" }` y no
> hace nada: puedes programar el cron desde ya sin efectos.
