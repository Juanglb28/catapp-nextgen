# Checklist de cutover a producción — CatApp-NextGen

Lista imprimible para el día del pase a producción. Marca cada casilla en orden.
Contexto y comandos detallados en `docs/DEPLOY-STAGING.md`. No empieces la fase
2 hasta tener **todo** lo de la fase 0 en verde.

Fecha del cutover: ____________  ·  Responsable: ____________

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

## Datos a tener a mano (rellena antes de empezar)

- DATABASE_URL de **producción**: ______________________________________________
- DATABASE_URL de **staging** (por si acaso): __________________________________
- Ruta del último `.dump` de producción: ______________________________________
- URL pública de producción: __________________________________________________
- Versión de Postgres del servidor (para `pg_dump`/`pg_restore`): ______________

---

## Fase 0 — Prerrequisitos (días antes)

- [ ] Staging desplegado y **validado** con datos reales (smoke-tests OK).
- [ ] Migraciones **0025 → 0026 → 0027** corrieron en staging sin error.
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

- [ ] Dispara el deploy de NextGen a producción (push a `main` o "Deploy").
- [ ] **Observa los logs del deploy**: `preDeployCommand` corre `pnpm db:migrate`
      y debe aplicar 0025–0027 **sin error** ANTES de que arranque la app.
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

- [ ] Actualiza URLs de producción en servicios externos si cambió el dominio:
      redirect URIs de Google, webhook de WhatsApp en Meta.
- [ ] Confirma que los crons quedaron activos (cumpleaños, recordatorio-mañana,
      y `/api/cron/reminders` si usas WhatsApp).
- [ ] Monitorea errores (Sentry/logs de Railway) las primeras horas.
- [ ] Comunica que el cambio terminó.

---

## Plan de ROLLBACK (si algo sale mal después de migrar)

1. [ ] Restaura el backup fresco de la Fase 1 en la DB de producción:
       `pg_restore -d "…PROD…" --clean --no-owner --no-privileges catapp-prod-cutover-YYYYMMDD.dump`
       (`--clean` reemplaza los objetos; ten cuidado, esto revierte a 0024).
2. [ ] Vuelve a desplegar la **app anterior** (su repo sigue intacto), que espera
       el esquema 0024.
3. [ ] Verifica `/api/health` y un smoke-test rápido de la versión anterior.
4. [ ] Comunica la reversión y agenda un nuevo intento tras corregir la causa.

> El rollback depende 100% del backup fresco de la Fase 1. Si no lo tienes, no
> empieces el cutover.

> **Alternativa de recuperación (PITR):** en vez del `pg_restore`, restaura con
> PITR al momento **justo antes del deploy** (crea un servicio Postgres nuevo) y
> apunta la app anterior a la `DATABASE_URL` de ese servicio nuevo. Sirve si el
> dump manual fallara o para volver a un segundo exacto. Aun así, el dump
> off-platform sigue siendo la red principal (independiente de Railway).
