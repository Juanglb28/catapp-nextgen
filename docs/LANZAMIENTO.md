# Checklist de lanzamiento — CatApp

> Generado: 2026-06-17
> Ejecutado por: Susana González / Juan
> URL de producción: `https://catapp-production.up.railway.app`

---

## 1. Estado de bloques (todos ✅ antes de lanzar)

| Bloque | Nombre                                    | Estado                                |
| ------ | ----------------------------------------- | ------------------------------------- |
| F0.B1  | Scaffold y herramientas de calidad        | ✅                                    |
| F0.B2  | PWA base (Serwist)                        | ✅                                    |
| F0.B3  | Layout mobile-first y navegación          | ✅                                    |
| F0.B4  | Base de datos y healthcheck               | ✅                                    |
| F0.B5  | GitHub, CI y deploy en Railway            | ✅                                    |
| F1.B1  | Better Auth: registro y login             | ✅                                    |
| F1.B2  | Tenants y contexto de sesión              | ✅                                    |
| F1.B3  | Onboarding del negocio                    | ✅                                    |
| F1.B4  | Tests de aislamiento multi-tenant         | ✅                                    |
| F2.B1  | Módulo de clientas                        | ✅                                    |
| F2.B2  | Catálogo de servicios                     | ✅                                    |
| F3.B1  | Modelo de datos de citas y auditoría      | ✅                                    |
| F3.B2  | Crear cita                                | ✅                                    |
| F3.B3  | Agenda (vista principal)                  | ✅                                    |
| F3.B4  | Detalle y edición en vivo                 | ✅                                    |
| F3.B5  | Ficha de clienta con historial            | ✅                                    |
| F4.B1  | Página pública de cita                    | ✅                                    |
| F4.B2  | Mensajes de WhatsApp con wa.me            | ✅                                    |
| F4.B3  | Archivo .ics (calendario de la clienta)   | ✅                                    |
| F5.B1  | Conexión OAuth y almacenamiento de tokens | ✅                                    |
| F5.B2  | Sincronización de citas                   | ✅                                    |
| F6.B1  | Consultas financieras                     | ✅                                    |
| F6.B2  | Dashboard de finanzas                     | ✅                                    |
| F7.B1  | Modelo de inventario                      | ✅                                    |
| F7.B2  | UI de inventario y alertas                | ✅                                    |
| F8.B1  | Infraestructura de envío y webhook        | ✅                                    |
| F8.B2  | Recordatorios programados                 | ✅                                    |
| F9.B1  | Offline y experiencia de instalación      | ✅                                    |
| F9.B2  | Rendimiento y accesibilidad               | ✅ (Perf 98 / A11y 96 / SEO 100)      |
| F9.B3  | Suite E2E completa y regresión            | ✅ (21 passed / 5 skipped / 0 failed) |
| F10.B1 | Seguridad                                 | ✅                                    |
| F10.B2 | Operación: backups, monitoreo, errores    | ✅                                    |
| F10.B3 | Checklist de lanzamiento                  | ✅                                    |

**Resultado: todos los bloques completados. La app está lista para recibir usuarias reales.**

---

## 2. Deuda técnica aceptada (post-lanzamiento)

Las siguientes deudas son **conocidas, documentadas y no bloqueantes** para el lanzamiento:

| #   | Deuda                            | Severidad | Detalle                                                                                                      | Cuándo abordar              |
| --- | -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| D1  | CSP nonce                        | Media     | El CSP actual usa `unsafe-inline` para estilos. Un nonce por request eliminaría esto.                        | Sprint 2 post-lanzamiento   |
| D2  | Rate limiting con Redis          | Baja      | El token bucket actual es por proceso Node. Solo impacta si se escala a >1 instancia en Railway.             | Al escalar                  |
| D3  | Email verification               | Baja      | El registro no verifica el correo. Un usuario puede registrarse con un email falso.                          | Sprint 2 post-lanzamiento   |
| D4  | Actualizaciones de versión mayor | Baja      | Next 16, TypeScript 6, Vitest 4, ESLint 10 disponibles. Dependabot los propondrá vía PR.                     | Uno a uno, post-lanzamiento |
| D5  | Verificación del build local     | N/A       | El build de F10.B2 (Sentry) requiere `pnpm install` previo tras añadir `@sentry/nextjs`.                     | Antes del primer push       |
| D6  | Prueba de restauración de backup | Alta      | El RUNBOOK documenta el procedimiento; debe ejecutarse una vez en producción antes de dar acceso a usuarias. | Inmediatamente post-deploy  |

> **D6 es el único pendiente operativo antes de abrir la app al público.** Los demás son mejoras técnicas.

---

## 3. Checklist pre-lanzamiento (ejecutar en orden)

### 3.1 Secretos y variables (Railway)

- [ ] `BETTER_AUTH_SECRET` rotado con `openssl rand -base64 32`
- [ ] `BETTER_AUTH_URL` apunta al dominio de producción correcto
- [ ] `DATABASE_URL` inyectada desde el plugin de Postgres de Railway
- [ ] `GOOGLE_TOKEN_KEY` generado con `openssl rand -base64 32` (para Calendar)
- [ ] `CRON_SECRET` generado con `openssl rand -base64 32`
- [ ] Variables de WhatsApp presentes (o vacías si no se activa en este lanzamiento)
- [ ] Variables de Sentry presentes (o vacías — Sentry queda inactivo si falta el DSN)

### 3.2 Infraestructura

- [ ] `/api/health` responde `{"ok":true,"db":true}` en producción
- [ ] CI (GitHub Actions) en verde en `main`
- [ ] Migraciones aplicadas (`pnpm db:migrate` vía preDeploy de Railway)
- [ ] UptimeRobot configurado sobre `/api/health` con alerta por email (ver RUNBOOK §2)
- [ ] Prueba de restauración de backup ejecutada y documentada (ver RUNBOOK §1.2)

### 3.3 Legal

- [ ] `/privacidad` accesible y revisada por abogado
- [ ] `/terminos` accesible y revisada por abogado
- [ ] El negocio tiene un mecanismo para registrar el consentimiento de sus clientas

### 3.4 Google Calendar (si se activa)

- [ ] Google Cloud: redirect URIs de producción añadidos
- [ ] Google Cloud: Calendar API habilitada
- [ ] OAuth consent screen en modo **Production** (no Testing) o las usuarias añadidas como Test users

### 3.5 WhatsApp Cloud API (si se activa)

- [ ] Plantillas aprobadas por Meta (`recordatorio`, `confirmacion`)
- [ ] Webhook verificado contra el dominio de producción
- [ ] `CRON_SECRET` configurado y cron activo (Railway o GitHub Actions, ver DEPLOY.md)

---

## 4. Prueba de humo final en producción

> Ejecutar con una cuenta nueva (no la de desarrollo) sobre la URL de producción.
> Marcar ✅ cada ítem al completarlo.

### Flujo completo

| #   | Paso                                                                       | Resultado esperado                                                     |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Registro** — `/registro` con correo y contraseña nueva                   | Cuenta creada, redirige a `/onboarding`                                |
| 2   | **Onboarding** — nombre del negocio, WhatsApp CO, zona horaria             | Negocio creado, redirige a `/citas`                                    |
| 3   | **Crear clienta** — `/clientas` → FAB → nombre + teléfono                  | Clienta aparece en la lista                                            |
| 4   | **Catálogo** — `/ajustes/servicios` → crear servicio con precio y duración | Servicio activo en lista                                               |
| 5   | **Crear cita** — `/citas/nueva` → clienta + servicio + fecha/hora          | Cita creada, redirige al detalle                                       |
| 6   | **Agenda** — `/citas` muestra la cita en el día correcto                   | Tarjeta visible con hora, clienta, total                               |
| 7   | **Detalle de cita** — editar nota y registrar pago parcial                 | Historial de cambios actualizado, saldo correcto                       |
| 8   | **Link público** — botón Compartir → abrir link en incógnito               | Página pública muestra negocio, clienta (solo nombre), servicios, hora |
| 9   | **ICS** — botón "Agregar a mi calendario" en la página pública             | Descarga `.ics` válido; se importa a Google/iOS Calendar               |
| 10  | **Mensaje WhatsApp manual** — botón "Mensaje" → plantilla confirmación     | Se abre `wa.me` con el mensaje prellenado                              |
| 11  | **Completar cita** — cambiar estado a "Completada"                         | Badge verde, cita read-only salvo pago                                 |
| 12  | **Finanzas** — `/finanzas` del mes actual                                  | Total del mes, cita aparece en el desglose                             |
| 13  | **Export CSV** — botón Descargar CSV                                       | Archivo `.csv` descargable con los datos del mes                       |
| 14  | **Inventario** — `/inventario` → crear producto con stock inicial          | Producto visible, sin alerta de stock bajo                             |
| 15  | **Movimiento** — salida de 1 unidad                                        | Stock disminuye; si queda bajo el mínimo, aparece badge rojo           |
| 16  | **Ficha de clienta** — `/clientas/[id]`                                    | Historial con la cita creada, totales correctos                        |
| 17  | **Google Calendar** (si configurado) — `/ajustes/calendario` → conectar    | Correo conectado; cita futura sincronizada                             |
| 18  | **WhatsApp automático** (si configurado) — toggle ON en Ajustes            | Al crear cita siguiente, llega confirmación                            |
| 19  | **PWA Android** — Chrome → menú → "Instalar app"                           | Ícono "CA" rosado aparece en la pantalla principal                     |
| 20  | **PWA iOS** — Safari → Compartir → "Agregar a inicio"                      | App instalada, se abre en modo standalone                              |
| 21  | **Offline** — poner el teléfono en modo avión y navegar                    | Banner "Sin conexión" aparece; las vistas ya cargadas siguen visibles  |

### Resultado de la prueba de humo

> Rellenar al ejecutarla:

- Fecha de ejecución: ******\_\_\_******
- Ejecutado por: ******\_\_\_******
- Ítems pasados: \_\_\_ / 21
- Observaciones: ******\_\_\_******

---

## 5. Monitoreo post-lanzamiento (primeras 48 horas)

- Revisar Railway Logs cada 2 horas el primer día
- Verificar que UptimeRobot no haya enviado alertas
- Revisar Sentry (si está configurado) — issues nuevos
- Confirmar que el cron de recordatorios corrió a la hora esperada (si WhatsApp activo)

---

## 6. Backlog post-lanzamiento

Las mejoras identificadas durante el desarrollo que no son bloqueantes para el lanzamiento:

1. **Email verification** al registrarse (D3)
2. **CSP nonce** para eliminar `unsafe-inline` (D1)
3. **Actualizaciones de versión mayor**: Next 16, TypeScript 6, ESLint 10, Vitest 4 (D4 — vía Dependabot PRs)
4. **Redis para rate limiting** al escalar a múltiples instancias (D2)
5. **Modo staff**: membresías con rol `staff` para empleadas adicionales (RF futuro)
6. **Pagos en línea**: integración con PSE o Wompi para cobro anticipado (RF futuro)
7. **Validación final por usuaria real**: una manicurista que no participó en el desarrollo completa el flujo sin ayuda. Sus confusiones = el backlog de UX.

---

_CatApp — todos los bloques completados. Lista para usuarias reales. 🎉_
