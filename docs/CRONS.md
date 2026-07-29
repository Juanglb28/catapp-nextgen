# Crons de CatApp-NextGen

Documento fuente de los trabajos programados (crons) de la app. Explica **cómo
funcionan en Railway**, **cómo están montados**, **cómo probarlos** y **cómo
replicarlos en producción**. Probado y verificado en staging el 2026-07-27.

> Resumen para el cutover: la receta paso a paso está también en
> `docs/CUTOVER-CHECKLIST.md`. Este documento es la explicación completa.

## Los dos crons

| Servicio (Railway)       | Endpoint                           | Schedule (UTC) | Hora Bogotá | Qué hace                                                                 |
| ------------------------ | ---------------------------------- | -------------- | ----------- | ------------------------------------------------------------------------ |
| `cron-birthdays`         | `POST /api/cron/birthdays`         | `0 11 * * *`   | 6:00 AM     | Crea el bono de cumpleaños del año y notifica por push a la manicurista. |
| `cron-reminder-tomorrow` | `POST /api/cron/reminder-tomorrow` | `0 1 * * *`    | 8:00 PM     | Push a cada negocio con citas al día siguiente.                          |

Hay un tercer endpoint, `POST /api/cron/reminders` (recordatorios de WhatsApp),
que solo aplica si se usa la integración de WhatsApp. Si se activa, se monta un
servicio cron igual a estos dos con su propio horario.

Todos los endpoints están protegidos por `Authorization: Bearer <CRON_SECRET>` y
responden `200` con un JSON de resumen.

## Cómo funcionan los crons en Railway (importante)

Un cron de Railway **no es un demonio dentro de la app**. En el horario indicado,
Railway **arranca una instancia del servicio, ejecuta su Start Command y espera a
que el proceso TERMINE**. Es un contenedor de un solo uso: corre → hace la tarea →
sale. Entre corridas no consume cómputo.

Dos consecuencias:

1. Un servicio web persistente (la app, `pnpm start`, que nunca termina) **no
   puede ser su propio cron**. Por eso cada cron es un **servicio aparte** y
   liviano cuyo comando arranca, pega al endpoint y sale.
2. El horario es **uno por servicio**. Como hay dos horarios distintos, hay dos
   servicios.

### El `[[crons]]` del `railway.toml` NO se aplica

El `railway.toml` del repo contiene un bloque `[[crons]]` con `name`/`schedule`/
`command`. **Ese formato no es válido para Railway y se ignora por completo.**
Railway solo lee del `railway.toml` los campos que soporta (builder, start
command, healthcheck, `cronSchedule` singular, etc.), no un array de crons.

Verificado en la UI: en Settings del servicio, el Healthcheck muestra "value is
set in /railway.toml" pero el **Cron Schedule aparece vacío** ("Add Schedule").
Es decir, los crons hay que crearlos como servicios en el dashboard; no vienen
del repo.

## Arquitectura de cada servicio cron

Cada cron es un servicio con:

- **Imagen:** `node:22-alpine` (liviana, trae `fetch` nativo, entrypoint ejecuta
  el comando y el proceso sale limpio).
- **Variable:** `CRON_SECRET` como **referencia** al servicio de la app
  (`${{<servicio-app>.CRON_SECRET}}`), nunca el valor pegado. En staging el
  servicio app es `catapp-nextgen`; en producción es `CatApp`.
- **Start Command:** un `node -e` que hace `POST` al endpoint con el header
  `Authorization: Bearer $CRON_SECRET`, loguea el status y el body, y sale con
  código 0 si `res.ok`, 1 si no.
- **Cron Schedule:** la expresión en **UTC** (ver tabla).
- **Restart Policy:** **Never** (un fallo no reintenta ni arriesga notificaciones
  duplicadas; el propio scheduler lo vuelve a correr al día siguiente).

### Start commands (copiar/pegar; ajustar la URL pública)

`cron-birthdays`:

```
node -e "fetch('https://<APP-PUBLICA>/api/cron/birthdays',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log('status',r.status,await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
```

`cron-reminder-tomorrow`:

```
node -e "fetch('https://<APP-PUBLICA>/api/cron/reminder-tomorrow',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log('status',r.status,await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
```

URL pública de staging: `https://catapp-nextgen-production.up.railway.app`.
En producción, usar el dominio de producción (p. ej. `https://catapp.beauty`).

## Cómo crear un servicio cron en Railway (paso a paso)

1. **Add → Docker Image** → `node:22-alpine`.
2. **Variables → New Variable** → `CRON_SECRET` = `${{<servicio-app>.CRON_SECRET}}`.
3. **Settings → Deploy → Custom Start Command** → el `node -e` de arriba.
4. **Settings → Deploy → Restart Policy** → **Never**.
5. **Settings → Deploy → Cron Schedule** → **Custom** → la expresión UTC.
6. **Deploy**.
7. Renombrar el servicio a `cron-birthdays` / `cron-reminder-tomorrow`
   (doble clic en el nombre del servicio).

## Cómo probarlo sin esperar al horario

En la pestaña **Cron Runs** del servicio hay un botón **Run now** que dispara una
corrida inmediata. Tras unos segundos, en **Deploy Logs** de esa corrida se ve la
respuesta. También sirve para el smoke-test post-cutover.

### Salidas esperadas (verificadas en staging)

`cron-birthdays`:

```
Starting Container
status 200 {"ok":true,"clients":N,"created":C,"notified":M}
```

`cron-reminder-tomorrow`:

```
Starting Container
status 200 {"ok":true,"tenantsWithCitas":N,"notified":M}
```

## Semántica del resultado (idempotencia)

El cron de cumpleaños es **idempotente**: no duplica el regalo.

- `clients` = clientas con cumpleaños hoy (evaluado en la **zona horaria del
  tenant**, no en UTC; por eso probarlo a cualquier hora del día detecta bien los
  cumpleaños de "hoy").
- `created` sube **solo si el bono del año se creó nuevo** (status
  `pending_manicurist`). Si la clienta ya tenía bono de este año, `upsert` no crea
  nada y `created` no sube.
- El envío de push está **anidado dentro** de la rama de creación. Por eso, si
  `created` es 0, `notified` también es 0 — no significa que el push falle, sino
  que no se llegó a esa línea.

Ejemplo real: una primera corrida dio `clients:1, created:0, notified:0` porque
esa clienta ya tenía su bono. Al crear una clienta nueva con cumpleaños hoy, la
siguiente corrida dio `clients:2, created:1, notified:1` (bono creado + push
enviado). Todo correcto.

Para que `notified` suba a 1 debe existir además una **suscripción push activa**
para ese negocio (un dispositivo con las notificaciones activadas).

## Zona horaria

- Los **schedules de Railway son en UTC**. `0 11 * * *` = 11:00 UTC = 6:00 AM
  Bogotá (UTC-5). `0 1 * * *` = 01:00 UTC = 8:00 PM Bogotá del día anterior.
- La **lógica de negocio** (qué es "hoy"/"mañana") se evalúa en la zona del tenant
  (`America/Bogota` por defecto) dentro del endpoint (ver `R-D4`).

## Replicar en producción (cutover)

Los crons **no** se despliegan solos con la app. En el cutover hay que **crear los
dos servicios** en el proyecto de producción con la receta de arriba (paso a paso
también en `docs/CUTOVER-CHECKLIST.md`), usando:

- La **URL pública de producción** en el start command.
- `CRON_SECRET` referenciado al servicio de la app de producción (`CatApp`).
- Un `CRON_SECRET` **de producción distinto** al de staging.

## Referencia rápida (staging)

- Proyecto: `CatApp_Staging`.
- App: `catapp-nextgen` (`https://catapp-nextgen-production.up.railway.app`).
- Crons: `cron-birthdays` (`0 11 * * *`), `cron-reminder-tomorrow` (`0 1 * * *`).

## Referencia rápida (producción) — creados y verificados 2026-07-29

- Proyecto: `Project_Independency_CatApp`, entorno `production`.
- App: `CatApp` (`https://catapp.beauty`).
- Ambos servicios cron creados siguiendo la receta de arriba (imagen
  `node:22-alpine`, `CRON_SECRET` referenciado a `${{CatApp.CRON_SECRET}}`,
  Restart Policy `Never`).
- **`cron-birthdays`** (`0 11 * * *` UTC = 6:00 AM Bogotá): probado con
  "Run now" → `status 200 {"ok":true,"clients":0,"created":0,"notified":0}`.
- **`cron-reminder-tomorrow`** (`0 1 * * *` UTC = 8:00 PM Bogotá): probado con
  "Run now" → `status 200 {"ok":true,"tenantsWithCitas":1,"notified":1}`.
- Hallazgo durante la creación: al ir a agregar `CRON_SECRET` en el primer
  servicio cron, Railway avisó que la variable **ya existía con un valor**
  cargado previamente (no documentado en ese momento). Se mantuvo la variable
  ya existente en el servicio `CatApp` (no se sobrescribió) y ambos crons la
  referencian con `${{CatApp.CRON_SECRET}}`, nunca con el valor pegado.
- Nota operativa: al crear el segundo servicio cron se generó por error un
  servicio adicional llamado "function-bun" (tecleo accidental sobre un atajo
  global mientras se escribía en el campo de variable). Se eliminó de
  inmediato desde Settings → Danger → Delete Service, confirmando el nombre.
  Ambos servicios cron finales quedaron limpios, sin rastro de ese incidente.
