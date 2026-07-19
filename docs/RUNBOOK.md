# Runbook de operación — CatApp (F10.B2)

> Procedimientos paso a paso para incidentes comunes en producción.
> URL producción: `https://catapp-production.up.railway.app`
> Última actualización: 2026-06-17

---

## 1. Backups de PostgreSQL en Railway

### 1.1 Backups automáticos

Railway crea backups automáticos del plugin de Postgres según el plan:

| Plan Railway  | Retención | Frecuencia |
| ------------- | --------- | ---------- |
| Hobby / Trial | 1 día     | Diaria     |
| Pro           | 7 días    | Diaria     |

Para verificar los backups disponibles:

1. Abre tu proyecto en [railway.app](https://railway.app)
2. Haz clic en el servicio **PostgreSQL**
3. Ve a la pestaña **Backups**
4. Verás la lista de backups con fecha y tamaño

### 1.2 Restauración de prueba (procedimiento verificado)

> Ejecutar este procedimiento al menos una vez antes del lanzamiento para confirmar que funciona.

**Paso 1 — Crear una DB temporal en Railway:**

```bash
# En tu proyecto Railway, crea un nuevo plugin PostgreSQL llamado "catapp-restore-test"
# (desde la UI de Railway: + New > Database > Add PostgreSQL)
# Copia la DATABASE_URL del nuevo plugin.
```

**Paso 2 — Descargar el backup:**

```bash
# En Railway > PostgreSQL > Backups, descarga el backup más reciente (.sql.gz o .dump).
# El archivo se descarga a tu máquina.
```

**Paso 3 — Restaurar en la DB temporal:**

```bash
# Descomprimir si es .gz:
gunzip backup_FECHA.sql.gz

# Restaurar con pg_restore (si es .dump):
pg_restore --no-owner -d "postgresql://user:pass@host:port/catapp_restore_test" backup_FECHA.dump

# O con psql (si es .sql):
psql "postgresql://user:pass@host:port/catapp_restore_test" < backup_FECHA.sql
```

**Paso 4 — Verificar:**

```sql
-- Conéctate a la DB restaurada y verifica:
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM appointments;
SELECT MAX(created_at) FROM appointments;  -- fecha del registro más reciente
```

**Paso 5 — Limpiar:**

```bash
# Elimina el plugin temporal desde la UI de Railway.
```

### 1.3 Restauración de emergencia (producción)

> ⚠️ IRREVERSIBLE. Ejecutar solo si hay pérdida de datos confirmada.

1. Poner la app en modo mantenimiento (deshabilitar el deploy o cambiar la variable `MAINTENANCE_MODE=true` si está implementada).
2. En Railway > PostgreSQL > Backups, seleccionar el backup previo al incidente.
3. Hacer clic en **Restore** y confirmar.
4. Ejecutar las migraciones pendientes si el código está adelantado del backup: `pnpm db:migrate`.
5. Verificar `/api/health`.
6. Volver a habilitar el deploy.

---

## 2. Monitoreo de uptime

### 2.1 Healthcheck de Railway

Railway ya tiene un healthcheck configurado en `railway.json`:

```json
{ "healthcheck": "/api/health" }
```

`/api/health` responde `{"ok":true,"db":true}` cuando la app y la DB están disponibles.

### 2.2 Monitor externo gratuito — UptimeRobot

**Paso a paso para configurar:**

1. Crear cuenta en [uptimerobot.com](https://uptimerobot.com) (plan Free: 50 monitores, check cada 5 min).
2. Clic en **+ Add New Monitor**.
3. Configurar:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: CatApp Production
   - **URL**: `https://catapp-production.up.railway.app/api/health`
   - **Monitoring Interval**: 5 minutes
4. En **Alert Contacts**, añadir tu email para recibir alertas cuando caiga y cuando se recupere.
5. Clic en **Create Monitor**.

El monitor verifica que la respuesta sea HTTP 200. Si Railway cae o la DB no responde (503), UptimeRobot envía un email en < 5 minutos.

---

## 3. Cómo leer los logs en Railway

1. En Railway, abre el servicio **catapp** (no el de Postgres).
2. Pestaña **Logs** (o **Deployments > [deploy reciente] > Logs**).
3. Los logs de producción son JSON estructurado (formato del `logger` de CatApp):
   ```json
   {
     "level": "error",
     "msg": "Error sincronizando calendario",
     "ts": "2026-06-17T10:00:00Z",
     "tenantId": "abc-123",
     "module": "calendar"
   }
   ```
4. Usa el campo de búsqueda para filtrar por `tenantId` o `module`.
5. Para errores detallados con stack trace, ve a **Sentry** (ver §4).

---

## 4. Sentry — errores en producción

### 4.1 Primera configuración (hacer una vez)

1. Crear cuenta en [sentry.io](https://sentry.io) (plan Free: 5 000 errores/mes).
2. Crear organización y proyecto: **Platform → Next.js**.
3. Copiar el **DSN** del proyecto.
4. En Railway, añadir las variables de entorno:
   ```
   NEXT_PUBLIC_SENTRY_DSN = https://xxx@oyyy.ingest.sentry.io/zzz
   SENTRY_DSN             = https://xxx@oyyy.ingest.sentry.io/zzz   (mismo valor)
   SENTRY_AUTH_TOKEN      = sntrys_xxx   (Settings > Auth Tokens > Create token con scope source:write)
   SENTRY_ORG             = tu-org-slug
   SENTRY_PROJECT         = catapp-nextjs
   ```
5. En Sentry > Project Settings > Alerts > crear una alerta de tipo **"New Issue"** con notificación por email.
6. Hacer un nuevo deploy en Railway para que tome las variables.

### 4.2 Uso diario

- **Sentry Dashboard**: muestra los errores agrupados por tipo, frecuencia y usuarios afectados.
- **Resolución**: cuando corriges un error, márcalo como "Resolved" en Sentry para dejar de recibir alertas.
- **Filtros útiles**: filtrar por `environment: production` para no confundir con errores de desarrollo.

---

## 5. Qué hacer si la app está caída

### Diagnóstico rápido (< 2 minutos)

```
1. ¿Railway está up?     → status.railway.app
2. ¿La DB responde?      → Railway > PostgreSQL > Connect > psql "SELECT 1"
3. ¿El build falló?      → Railway > Deployments > último deploy (busca error en rojo)
4. ¿Sentry tiene errores? → sentry.io > Issues (filtrar última hora)
5. ¿Los logs dicen algo? → Railway > Logs (buscar "error" o "fatal")
```

### Acciones por caso

| Síntoma                                   | Causa probable                                 | Acción                                                                        |
| ----------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| HTTP 500 en todas las rutas               | Error en el código del último deploy           | Rollback (ver §6)                                                             |
| HTTP 503 en `/api/health` con `db: false` | PostgreSQL caído o connection pool agotado     | Reiniciar servicio Postgres en Railway                                        |
| Deploy colgado (sin completar en 10 min)  | Build fallido o healthcheck no pasa            | Revisar logs del deploy; cancelar y hacer nuevo deploy                        |
| `FATAL: password authentication failed`   | Variable DATABASE_URL incorrecta               | Verificar Railway > catapp > Variables                                        |
| Google Calendar deja de sincronizar       | Token revocado (`broken` en `google_accounts`) | La UI muestra "Reconectar". El usuario debe reconectar en /ajustes/calendario |
| WhatsApp deja de enviar mensajes          | Access token expirado o plantilla rechazada    | Renovar `WA_ACCESS_TOKEN` en Meta y en Railway                                |

---

## 6. Rollback de un deploy

Railway mantiene el historial de deploys y permite volver al anterior en segundos.

**Desde la UI:**

1. Railway > tu proyecto > servicio **catapp**.
2. Pestaña **Deployments**.
3. Busca el último deploy exitoso (antes del incidente).
4. Clic en los tres puntos (**···**) > **Redeploy**.
5. Confirmar. El rollback tarda ~1-2 minutos.

**Desde la CLI de Railway:**

```bash
railway deployments   # lista los deploys con su ID
railway redeploy <deployment-id>
```

> Nota: si el deploy problemático incluía una migración de DB, el rollback del código **no revierte la migración**. En ese caso sigue el procedimiento de restauración de backup (§1.3).

---

## 7. Si la DB está casi llena

Railway Free Tier: 1 GB de PostgreSQL incluido. Plan Pro: 100 GB.

Para verificar el tamaño actual:

```sql
-- Tamaño total de la DB:
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Tablas más grandes:
SELECT relname AS table, pg_size_pretty(pg_total_relation_size(oid)) AS size
FROM pg_class
WHERE relkind = 'r'
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 10;
```

**Acciones si se acerca al límite:**

1. Purgar `appointment_changes` antiguas (> 1 año) si hay muchas.
2. Archivar `wa_messages` entregados/leídos > 6 meses.
3. Considerar subir el plan de Railway.

---

## 8. Rotación de secretos antes del lanzamiento

> Hacer esto una vez antes de abrir la app al público.

```bash
# Generar nuevo BETTER_AUTH_SECRET:
openssl rand -base64 32

# Generar nuevo GOOGLE_TOKEN_KEY (invalida todos los refresh tokens de Google guardados):
openssl rand -base64 32
# ⚠️ Tras cambiar GOOGLE_TOKEN_KEY, todos los tenants deben reconectar Google Calendar.

# Generar nuevo CRON_SECRET:
openssl rand -base64 32
```

Actualizar los valores en **Railway > Variables** y hacer un nuevo deploy.
