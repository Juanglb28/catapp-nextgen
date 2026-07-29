# Checklist de cutover a producción — CatApp-NextGen

Lista imprimible para el día del pase a producción. Marca cada casilla en orden.
Contexto y comandos detallados en `docs/DEPLOY-STAGING.md`. No empieces la fase
2 hasta tener **todo** lo de la fase 0 en verde.

Fecha del cutover: ****\_\_\_\_**** · Responsable: ****\_\_\_\_****

## Sobre los respaldos (PITR · volume backups · dump)

Tres capas complementarias; ninguna reemplaza a la otra:

- **PITR (activo, plan Pro):** restaura a un servicio Postgres **nuevo** en
  cualquier momento de la ventana de retención (~26 días). Ideal para recuperar
  de un error reciente sin perder el delta. Vive **dentro de Railway**.
- **Volume backups (Railway):** snapshots programados/on-demand del volumen,
  **independientes** de PITR. Actívalos para cobertura extra (Railway sugiere
  "keep both"). También viven en Railway.
- **`pg_dump` off-platform (este checklist):** la única copia **fuera** de
  Railway, portable y restaurable donde sea. Es tu artefacto de rollback del
  cutover y tu seguro ante un problema de la propia plataforma o de la cuenta.

Recomendación: mantén PITR + volume backups para lo continuo, y **aun así** toma
el dump manual del pre-flight. Prueba una restauración al menos una vez (p. ej.
en la DB de staging) — un backup no probado no cuenta.

> ⚠️ **Verificá el entorno antes de cada comando destructivo.** Producción y
> staging son proyectos distintos de Railway con connection strings distintas
> (host y puerto de proxy diferentes). Antes de un `pg_restore --clean` (o
> cualquier `pg_dump`/`psql` nuevo), corré primero `SELECT current_database();`
> y compará counts de tenants/clients/appointments contra lo esperado del
> entorno al que creés estar apuntando. No reutilices una connection string
> copiada de un paso anterior sin volver a confirmar de qué proyecto salió.

## Datos a tener a mano (rellena antes de empezar)

- DATABASE_URL de **producción**: **********************\_\_**********************
- DATABASE_URL de **staging** (por si acaso): ****************\_\_****************
- Ruta del último `.dump` de producción: ******************\_\_******************
- URL pública de producción: ************************\_\_************************
- Versión de Postgres del servidor (para `pg_dump`/`pg_restore`): ******\_\_******

---

## Fase 0 — Prerrequisitos (días antes)

- [ ] Staging desplegado y **validado** con datos reales (smoke-tests OK).
- [ ] Migraciones **0019 → 0028** corrieron en staging sin error, sobre una copia
      restaurada del backup real de producción (no sobre datos de prueba
      sintéticos — ver hallazgo 2026-07-29 abajo).
- [ ] Código respaldado en GitHub (`main` + rama `respaldo/…`) subido.
- [ ] Secretos de producción listos (BETTER_AUTH_SECRET, GOOGLE_TOKEN_KEY,
      CRON_SECRET, VAPID, Resend…), **distintos** a los de staging donde aplica.
- [ ] Ventana de mantenimiento acordada (poco tráfico).
- [ ] Tienes acceso a Railway, Google Cloud Console, Resend y (si aplica) Meta.

---

## Fase 1 — Pre-flight (minutos antes)

- [ ] Avisa a las usuarias si habrá una breve interrupción.
- [ ] **Backup FRESCO de producción** (imprescindible):
      `pg_dump "…PROD…" -Fc -f catapp-prod-cutover-YYYYMMDD.dump`
- [ ] Verifica que el `.dump` pesa lo esperado y está guardado **fuera** de Railway.
- [ ] Confirma las variables de entorno del servicio de producción (tabla en
      `DEPLOY-STAGING.md` §7). Ojo con las `NEXT_PUBLIC_*` (se incrustan en build).
- [ ] Confirma que `DATABASE_URL` del servicio apunta a la **DB de producción**.

---

## Fase 2 — Deploy y migraciones

> ⚠️ **Hallazgo del ensayo en staging (2026-07-29):** la tabla de tracking de
> Drizzle en producción solo tenía migraciones aplicadas hasta la **0018** — NO
> hasta la 0024 como se asumía. Es decir, faltan **0019 → 0028** (10
> migraciones, no 4), incluyendo migraciones con datos reales (0022, 0023).
> Además, **los Deploy Logs de Railway para `preDeployCommand` no son
> confiables para diagnosticar**: se vieron mezclados/interleaved entre
> contenedores, mostrando "migrations applied successfully" cuando en realidad
> no habían llegado a la última migración. **No confíes solo en ese log.**

- [ ] Dispara el deploy de NextGen a producción (push a `main` o "Deploy").
- [ ] **No confíes únicamente en los Deploy Logs para confirmar la migración.**
      Después del deploy, verificá el estado real contra la DB directamente:
      `sql
    SELECT count(*) FROM drizzle.__drizzle_migrations; -- esperado: todas las migraciones, no un subconjunto
    SELECT to_regclass('public.bonus_options'), to_regclass('public.rate_limits'),
           to_regclass('public.webauthn_credentials'), to_regclass('public.app_lock_settings'),
           to_regclass('public.appointments'); -- y columnas cash_cop/transfer_cop en appointments
    `
- [ ] Si algo faltara, corré la migración manualmente desde tu máquina (más
      confiable que el log de Railway, salida completa sin cortes):
      `powershell
    cd D:\Trabajo\CatApp-NextGen
    $env:DATABASE_URL="postgresql://...PROD..."
    pnpm db:migrate
    `
- [ ] Si las migraciones fallan → la app **no** arranca (fail-safe). No se sirve
      versión rota. Corrige y reintenta; no pases a la fase 3.
- [ ] La app arranca y el healthcheck de Railway pasa.

---

## Fase 3 — Verificación

- [ ] `https://<prod>/api/health` → `{ "ok": true, "db": true }`.
- [ ] Login por email y por Google.
- [ ] Registro con verificación de correo (llega el email de Resend).
- [ ] Agenda: crear/editar una cita, registrar un pago.
- [ ] Finanzas cuadran (revisa un mes con datos conocidos).
- [ ] Cumpleaños/bonos y, si aplica, push y WhatsApp.
- [ ] Datos previos intactos (clientas, citas, servicios de antes del cutover).
- [ ] Paleta de color y modo claro/oscuro (Ajustes → Apariencia).

---

## Fase 4 — Post-cutover

- [x] Actualiza URLs de producción en servicios externos si cambió el dominio:
      redirect URIs de Google, webhook de WhatsApp en Meta. (No aplica en este
      cutover: el dominio sigue siendo `catapp.beauty`, no cambió.)
      **Activación de WhatsApp Business: diferida a futuro** (decisión de Juan,
      2026-07-29) — pendiente de análisis de trade-offs (costos, Cloud API vs.
      wa.me manual, aprobación de plantillas). No bloquea el cutover; producción
      no tiene variables `WA_*` y la integración no está activa hoy.
- [x] **Crea los servicios cron en producción** (ver recuadro abajo). Railway NO
      los toma del `railway.toml`: el bloque `[[crons]]` no es formato válido y se
      ignora. Cada cron es un **servicio aparte** que corre y termina.
      **Hecho 2026-07-29** — ver detalle y hallazgos en `docs/CRONS.md` §
      "Referencia rápida (producción)".
- [x] Confirma que los crons quedaron activos: cumpleaños (`0 11 * * *` = 6 AM,
      `status 200 {"ok":true,"clients":0,"created":0,"notified":0}`),
      recordatorio-mañana (`0 1 * * *` = 8 PM,
      `status 200 {"ok":true,"tenantsWithCitas":1,"notified":1}`). No se usa
      `/api/cron/reminders` (WhatsApp) en este cutover.
- [ ] Monitorea errores (Sentry/logs de Railway) las primeras horas.
- [ ] Comunica que el cambio terminó.
- [ ] Pendiente: configurar reCAPTCHA v3 en producción (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY`) — ver `docs/RECAPTCHA.md`.

### Cómo crear cada servicio cron en Railway (receta)

Railway ejecuta el **start command** de un servicio en el horario indicado y
espera que el proceso **termine**. Un servicio web persistente (la app) no puede
ser su propio cron; por eso cada cron es un servicio independiente y liviano.
Explicación completa en `docs/CRONS.md`. Probado en staging el 2026-07-27.
Repetir en el proyecto de producción:

1. **Add → Docker Image** → `node:22-alpine`.
2. **Variables** → nueva variable `CRON_SECRET` = `${{<servicio-app>.CRON_SECRET}}`
   (referencia; nunca pegues el valor). En producción el servicio app se llama `CatApp`.
3. **Settings → Deploy → Custom Start Command** (una línea; ajusta la URL pública y el endpoint):
   `node -e "fetch('https://<APP-PUBLICA>/api/cron/birthdays',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log('status',r.status,await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"`
4. **Settings → Deploy → Restart Policy** → **Never** (un fallo no reintenta ni duplica notificaciones).
5. **Settings → Deploy → Cron Schedule** → **Custom** → la expresión del cron (UTC).
6. **Deploy**. Para probar sin esperar: pestaña **Cron Runs → Run now**; revisa los
   logs (debe salir `status 200 {...}`).

Servicios a crear (uno por cada horario, Railway solo admite un schedule por servicio):

| Cron                | Endpoint                      | Schedule (UTC) | Hora Bogotá |
| ------------------- | ----------------------------- | -------------- | ----------- |
| Cumpleaños          | `/api/cron/birthdays`         | `0 11 * * *`   | 6:00 AM     |
| Recordatorio-mañana | `/api/cron/reminder-tomorrow` | `0 1 * * *`    | 8:00 PM     |

---

## Plan de ROLLBACK (si algo sale mal después de migrar)

PITR está **activo desde el día 1** del despliegue de producción (plan Pro de
Railway). Por eso es la opción **recomendada** — evita el problema de
dependencias entre tablas que sí afecta al `pg_restore` manual (ver más abajo).

### Opción 1 (recomendada): PITR

1. [ ] En Railway → servicio Postgres de producción → pestaña **Backups/PITR** →
       restaura al momento **justo antes del deploy** del cutover. Esto crea un
       servicio Postgres **nuevo**, intacto en el esquema 0024, sin tocar el
       servicio original.
2. [ ] Apunta la app anterior (repo `Juanglb28/CatApp`, que sigue intacto) a la
       `DATABASE_URL` de ese servicio Postgres nuevo.
3. [ ] Verifica `/api/health` y un smoke-test rápido de la versión anterior.
4. [ ] Comunica la reversión y agenda un nuevo intento tras corregir la causa.

### Opción 2 (si PITR fallara): pg_dump/pg_restore manual

> ⚠️ **Verificá el entorno antes de correr esto.** Es el momento de más apuro
> del cutover y el más fácil para equivocarse de connection string. Corré
> primero `SELECT current_database();` + counts de tenants/clients/appointments
> contra la URL que vas a usar y confirmá que es realmente **producción**.

> ⚠️ **`pg_restore --clean` (sin más) NO alcanza.** Verificado en el ensayo de
> staging del 2026-07-29: falla porque las tablas nuevas de 0025-0028 (ej.
> `bonus_options`) tienen FKs hacia tablas viejas (`tenants`) y `--clean` no
> agrega `CASCADE` a sus DROP. Hay que vaciar el schema a mano primero:

1. [ ] Vacía el schema completo de producción (esto es tan destructivo como el
       propio rollback — solo hazlo si ya decidiste revertir):
   ```sql
   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
   DROP SCHEMA IF EXISTS drizzle CASCADE;
   ```
2. [ ] Restaura el backup fresco de la Fase 1 **sin** `--clean` (el schema ya
       quedó vacío, no hay nada que limpiar):
       `pg_restore -d "…PROD…" --no-owner --no-privileges catapp-prod-cutover-YYYYMMDD.dump`
3. [ ] Verifica los counts de tenants/clients/appointments contra los que
       registraste al tomar el backup.
4. [ ] Vuelve a desplegar la **app anterior** (su repo sigue intacto), que espera
       el esquema 0024.
5. [ ] Verifica `/api/health` y un smoke-test rápido de la versión anterior.
6. [ ] Comunica la reversión y agenda un nuevo intento tras corregir la causa.

> El rollback depende 100% del backup fresco de la Fase 1 (o de PITR). Si no
> tienes ninguno de los dos, no empieces el cutover.
