# Plan de Acción — CatApp: PWA SaaS para Manicuristas

> **Versión:** 2.0 — 2026-06-10
> **Autora del producto:** Susana González
> **Propósito de este documento:** servir como guía completa de desarrollo, fase por fase y bloque por bloque. Cada bloque incluye un prompt listo para pegar en Claude Cowork (o instrucciones suficientes para que lo ejecute una persona), criterios de validación y tests. **No se avanza al siguiente bloque sin que el actual pase su quality gate.**

---

## 1. Cómo usar este plan

1. Abre un chat nuevo de Claude Cowork con la carpeta `CatApp` seleccionada.
2. Pega el **Prompt de contexto inicial** (sección 1.1) al comienzo de cada chat nuevo.
3. Pega el prompt del bloque que corresponda. Un bloque por vez.
4. Al terminar el bloque, ejecuta el **Quality Gate** (sección 6). Si algo falla, se corrige en el mismo chat antes de continuar.
5. Haz commit en git al cerrar cada bloque (`git commit -m "F2.B1: CRUD clientas"`). Cada bloque = al menos un commit.
6. Cuando un chat se alargue demasiado, ciérralo y abre uno nuevo: el contexto vive en este archivo, en `docs/DECISIONES.md` y en el propio código.

### 1.1 Prompt de contexto inicial (pegar al inicio de cada chat nuevo)

```text
Estás trabajando en CatApp, una PWA SaaS mobile-first para manicuristas, en la carpeta seleccionada.
Antes de hacer cualquier cosa:
1. Lee PLAN-APP-MANICURISTAS.md (plan por fases) y docs/DECISIONES.md (decisiones cerradas, no las cambies sin preguntarme).
2. Lee docs/ESTADO.md para saber qué bloques están completados y cuál sigue.
3. Revisa la estructura actual del código antes de escribir código nuevo.

Reglas permanentes:
- Stack: Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Drizzle ORM + PostgreSQL, Serwist (PWA), pnpm, deploy en Railway.
- Mobile-first SIEMPRE: diseña para 360–430px de ancho primero; el desktop es secundario.
- Multi-tenant: TODA query a tablas de negocio filtra por tenant_id. Nunca expongas datos de un tenant a otro.
- Dinero: enteros bigint en pesos colombianos (sin decimales). Nunca floats. Formato es-CO ($50.000).
- Fechas: timestamptz en DB; zona horaria del tenant (default America/Bogota) solo al presentar.
- Idioma de la UI: español (es-CO). Código, identificadores y commits en inglés.
- Server Components por defecto; Client Components solo cuando hay interactividad. Mutaciones con Server Actions + validación Zod en el servidor.
- Al terminar el bloque: corre lint, typecheck, build y tests; deja docs/ESTADO.md actualizado con lo hecho y lo pendiente.
No avances a otro bloque distinto del que te indique.
```

---

## 2. Análisis de requerimientos

### 2.1 Requerimientos funcionales

| ID | Requerimiento | Detalle | Fase |
|----|---------------|---------|------|
| RF-01 | Gestión de citas | Crear cita con clienta, servicio(s), fecha/hora, monto, estado de pago (pagada/pendiente/parcial) y notas | F3 |
| RF-02 | Edición en vivo de citas | Durante la cita pueden cambiar servicios, precio, número de personas atendidas; todo editable con historial de cambios | F3 |
| RF-03 | Gestión de clientas | Registro de clientas (nombre, teléfono, notas, historial de citas) | F2 |
| RF-04 | Catálogo de servicios | Servicios con nombre, precio base y duración estimada | F2 |
| RF-05 | Compartir cita con la clienta | Página pública por cita (sin login) + mensaje personalizado por WhatsApp + archivo .ics | F4 |
| RF-06 | Google Calendar | Sincronizar citas con el calendario de la manicurista; invitación opcional a la clienta | F5 |
| RF-07 | Finanzas | Resumen mensual: total ganado, pagado vs pendiente, desglose por servicio y por clienta; export CSV | F6 |
| RF-08 | Inventario | Productos con stock, movimientos (entrada/salida/ajuste), alerta de stock mínimo | F7 |
| RF-09 | WhatsApp automático | Recordatorios automáticos vía WhatsApp Cloud API (plantillas aprobadas por Meta) | F8 |
| RF-10 | Multi-tenant (SaaS) | Varias manicuristas, cada una con sus datos aislados; registro y login | F1 |
| RF-11 | PWA instalable | Instalable en el teléfono, con funcionamiento básico offline (consultar agenda) | F0 + F9 |

### 2.2 Requerimientos no funcionales

| ID | Requerimiento | Criterio medible |
|----|---------------|------------------|
| RNF-01 | Mobile-first | Toda pantalla usable con una mano en 360px; targets táctiles ≥ 44px |
| RNF-02 | Rendimiento | Lighthouse móvil: Performance ≥ 90, PWA instalable; LCP < 2.5s en 4G |
| RNF-03 | Seguridad | Aislamiento estricto por tenant; OWASP Top 10 cubierto; secretos solo en variables de entorno |
| RNF-04 | Calidad de código | TypeScript strict sin `any` injustificado; ESLint + Prettier sin warnings; cobertura de tests en lógica de negocio ≥ 80% |
| RNF-05 | Escalabilidad | Arquitectura por módulos de dominio; índices en DB por tenant_id; sin estado en el servidor (escala horizontal) |
| RNF-06 | Mantenibilidad | Cada módulo documentado; migraciones versionadas; convenciones consistentes |
| RNF-07 | Disponibilidad | Healthcheck monitoreado; backups diarios de Postgres; rollback de deploy posible |

### 2.3 Fuera de alcance (por ahora)

Pagos en línea de las clientas, app nativa (iOS/Android), agenda con reserva self-service por parte de las clientas, facturación electrónica DIAN, soporte multi-idioma. Se pueden añadir como fases futuras sin rediseñar: el modelo multi-tenant y el modelo de citas ya lo permiten.

---

## 3. Arquitectura y decisiones técnicas

### 3.1 Stack (decisión cerrada — ver docs/DECISIONES.md)

| Capa | Tecnología | Por qué |
|------|------------|---------|
| Framework | Next.js 15 (App Router) + React | Un solo proyecto para UI + API; Server Components reducen JS en móviles de gama baja |
| Lenguaje | TypeScript `strict` | Errores en compilación, no en producción |
| UI | Tailwind CSS v4 + shadcn/ui | Velocidad de desarrollo, componentes accesibles, look profesional |
| PWA | Serwist | Sucesor mantenido de next-pwa; service worker tipado |
| DB | PostgreSQL + Drizzle ORM | SQL tipado, migraciones versionadas, sin magia oculta |
| Auth | Better Auth | Email+password y Google OAuth, sesiones en DB, organización/tenant integrable |
| Validación | Zod | Mismo esquema valida formularios (cliente) y Server Actions (servidor) |
| Tests | Vitest (unit/integration) + Playwright (E2E) | Estándar actual del ecosistema |
| Hosting | Railway (app + Postgres + cron) | Simple, todo en un lugar, backups gestionados |
| Repositorio | GitHub + GitHub Actions (CI) | Lint+typecheck+tests en cada push; deploy automático a Railway |

### 3.2 Multi-tenancy

- Estrategia: **una sola base de datos, aislamiento por columna `tenant_id`** en todas las tablas de negocio. Es lo correcto para este tamaño (cientos/miles de tenants pequeños); separar por schema o DB sería sobre-ingeniería.
- Un `tenant` = un negocio de manicura. Tabla `tenants` (id, nombre del negocio, teléfono, timezone, moneda, plan).
- Todo acceso a datos pasa por un repositorio que **exige** `tenantId` como parámetro; está prohibido importar el cliente de Drizzle directamente en páginas o acciones (regla de ESLint `no-restricted-imports`).
- Índices compuestos `(tenant_id, ...)` en toda tabla de negocio.
- Tests de aislamiento obligatorios (F1.B4): un tenant jamás ve datos de otro.

### 3.3 Modelo de datos (visión global)

```text
tenants        (id, name, phone, timezone, currency, public_address?, public_note?, created_at)
users          (Better Auth) ──< memberships (user_id, tenant_id, role: owner|staff)
clients        (id, tenant_id, name, phone, email?, notes, wa_opt_out bool, created_at, archived_at?)
services       (id, tenant_id, name, base_price_cop bigint, duration_min, active)
appointments   (id, tenant_id, client_id, starts_at timestamptz, ends_at,
                status: scheduled|completed|cancelled|no_show,
                payment_status: pending|partial|paid,
                total_cop bigint, paid_cop bigint, people_count int default 1,
                notes, public_token uuid unique, sequence int,           -- sequence: F4.B3 (.ics)
                gcal_event_id?, gcal_sync_status?,                       -- F5
                created_at, updated_at)
appointment_services (appointment_id, service_id, price_cop bigint, quantity)  -- precio congelado al momento
appointment_changes  (id, appointment_id, changed_at, changed_by, field, old_value, new_value)  -- auditoría RF-02
message_templates    (id, tenant_id, key, text)                          -- F4.B2, textos personalizables
products       (id, tenant_id, name, stock numeric, unit, min_stock, cost_cop?, active)
stock_movements(id, tenant_id, product_id, type: in|out|adjust, quantity (delta), reason?, created_by, created_at)
google_accounts(id, tenant_id, google_email, refresh_token cifrado, calendar_id, sync_enabled)  -- F5
wa_messages    (id, tenant_id, appointment_id?, to_phone, template_name,
                status: queued|sent|delivered|read|failed, wa_message_id?, error?, created_at, updated_at)  -- F8
```

Cada tabla nace en la fase que la necesita (el bloque correspondiente trae su migración); este diagrama es la foto final para entender el conjunto.

Notas clave: el precio del servicio se **congela** en `appointment_services` (si luego sube el precio del catálogo, las citas pasadas no cambian). `total_cop` es editable directamente además de derivable, porque en la vida real se negocian precios. Toda edición de cita escribe en `appointment_changes`.

### 3.4 Estructura de carpetas

```text
src/
  app/                  # rutas (App Router)
    (app)/              # rutas autenticadas con bottom-nav: /citas /clientas /finanzas /inventario /ajustes
    (auth)/             # /login /registro /onboarding
    (public)/cita/[token]/   # página pública para la clienta
    api/                # webhooks (WhatsApp), cron, health
  modules/              # lógica de dominio, UNA carpeta por módulo
    appointments/  clients/  services/  finance/  inventory/  calendar/  whatsapp/  tenancy/
      schema.ts         # tablas Drizzle del módulo
      repository.ts     # acceso a datos (exige tenantId)
      actions.ts        # Server Actions (validan sesión + Zod)
      components/       # componentes UI del módulo
      *.test.ts         # tests junto al código
  lib/                  # db, auth, utils (dinero, fechas), config
  components/ui/        # shadcn/ui
docs/                   # DECISIONES.md, ESTADO.md, runbooks
drizzle/                # migraciones generadas
e2e/                    # tests Playwright
```

---

## 4. Mapa de fases

| Fase | Nombre | Entrega visible | Depende de |
|------|--------|-----------------|------------|
| F0 | Fundamentos | Proyecto desplegado en Railway con PWA instalable y navegación vacía | — |
| F1 | Auth y multi-tenancy | Registro, login, onboarding del negocio, aislamiento probado | F0 |
| F2 | Clientas y servicios | CRUD completo de clientas y catálogo de servicios | F1 |
| F3 | Citas | Agenda funcional: crear, ver, editar en vivo, estados de pago, auditoría | F2 |
| F4 | Compartir con clientas | Página pública por cita + mensajes wa.me + .ics | F3 |
| F5 | Google Calendar | Sync bidireccional básico + invitación a clientas | F3 |
| F6 | Finanzas | Dashboard mensual con totales, pagado/pendiente, export CSV | F3 |
| F7 | Inventario | Stock, movimientos, alertas de mínimo | F1 |
| F8 | WhatsApp Cloud API | Recordatorios automáticos con plantillas Meta | F4 |
| F9 | PWA avanzada y pulido | Offline, performance ≥90, accesibilidad, E2E completo | F2–F7 |
| F10 | Hardening y lanzamiento | Seguridad, backups, monitoreo, checklist de salida | todo |

F5, F6 y F7 son independientes entre sí: si un bloque se atasca, se puede avanzar con otra de estas fases. F4 y F8 son secuenciales (F8 reutiliza la mensajería de F4).

---

## 5. Convenciones de desarrollo (aplican a TODOS los bloques)

- **Commits:** convencionales (`feat:`, `fix:`, `chore:`, `test:`), un commit mínimo por bloque, mensaje con el ID del bloque.
- **Ramas:** trabajo directo en `main` mientras el equipo sea una persona + Cowork; CI bloquea push roto. (Si entra más gente: PRs obligatorios.)
- **Server Actions:** siempre validan (1) sesión activa, (2) pertenencia al tenant, (3) input con Zod. En ese orden. Devuelven `{ ok: true, data } | { ok: false, error }`, nunca lanzan excepciones a la UI.
- **Errores:** mensajes de error en español y accionables para la usuaria; detalles técnicos solo a logs.
- **Dinero:** helpers únicos en `lib/money.ts` (`formatCOP`, `parseCOP`). Prohibido formatear dinero a mano.
- **Fechas:** helpers únicos en `lib/dates.ts` usando la TZ del tenant. Prohibido `new Date().toLocaleString()` suelto.
- **Componentes:** sin lógica de negocio en componentes; la lógica vive en `modules/*/`.
- **Accesibilidad:** labels en todos los inputs, contraste AA, foco visible.

## 6. Quality Gate (cierre obligatorio de CADA bloque)

```text
1. pnpm lint          → 0 errores, 0 warnings
2. pnpm typecheck     → 0 errores
3. pnpm test          → todos los tests pasan (los del bloque incluidos)
4. pnpm build         → build de producción exitoso
5. Prueba manual móvil: abrir la app con viewport 390px (DevTools) y ejecutar el flujo del bloque de punta a punta
6. Revisión de seguridad del bloque: ¿toda query filtra por tenant? ¿todo input se valida con Zod? ¿algún secreto en el código?
7. docs/ESTADO.md actualizado (bloque completado, fecha, notas)
8. git commit + push → CI en verde
```

Prompt corto para pedirle el gate a Cowork al final de cualquier bloque:

```text
Ejecuta el Quality Gate de la sección 6 del PLAN-APP-MANICURISTAS.md para el bloque que acabas de terminar. Muéstrame la salida real de lint, typecheck, test y build (no la resumas si hay errores). Si algo falla, corrígelo y vuelve a correr todo. Luego actualiza docs/ESTADO.md y haz el commit.
```

---

# FASE 0 — Fundamentos

**Objetivo:** proyecto base desplegado en producción desde el día 1. Deploy temprano = los problemas de infraestructura aparecen cuando el proyecto es pequeño.

## F0.B1 — Scaffold y herramientas de calidad

**Prompt para Cowork:**

```text
Bloque F0.B1. Crea el proyecto base de CatApp en la raíz de la carpeta seleccionada:
1. Next.js 15 con App Router, TypeScript strict, Tailwind CSS v4, ESLint. Usa pnpm. src/ como directorio raíz de código.
2. Configura Prettier (con plugin de Tailwind), e integra ESLint+Prettier sin conflictos.
3. Configura husky + lint-staged: pre-commit corre eslint --fix y prettier sobre los archivos staged.
4. Scripts en package.json: dev, build, start, lint, typecheck (tsc --noEmit), test (vitest run), test:watch, format.
5. Instala y configura Vitest con un test trivial de ejemplo que pase.
6. Inicializa shadcn/ui (estilo default, color base neutral) e instala los componentes: button, input, label, card, dialog, form, select, badge, sheet, tabs, sonner.
7. Crea .env.example documentando DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL (las fases posteriores añadirán las suyas; lista completa en el Apéndice C del plan) y deja .gitignore correcto (.env*, node_modules, .next).
8. Inicializa git con un commit inicial.
9. Crea docs/ESTADO.md con una tabla de bloques del plan y marca F0.B1 como completado al final.
Si el sandbox no permite pnpm install, deja todo escrito y dame los comandos exactos para correr yo en local.
Valida: pnpm lint, pnpm typecheck, pnpm test y pnpm build deben pasar.
```

**Validación:** los 4 comandos pasan; `pnpm dev` levanta la página; pre-commit formatea automáticamente. **Test:** el test de ejemplo de Vitest corre en verde.

## F0.B2 — PWA base

**Prompt para Cowork:**

```text
Bloque F0.B2. Convierte el proyecto en PWA con Serwist:
1. Instala @serwist/next y serwist. Configura next.config con el plugin (deshabilitado en dev).
2. Crea src/app/manifest.ts: name "CatApp", short_name "CatApp", display standalone, orientation portrait, theme_color y background_color acordes a una identidad limpia y femenina (elige una paleta y documéntala en docs/DECISIONES.md), lang es-CO, start_url /.
3. Genera iconos PNG 192x192, 512x512 y maskable 512x512 (puedes generarlos por código: fondo del color de marca + iniciales "CA"). Guárdalos en public/icons/.
4. Crea src/app/sw.ts con la configuración default de Serwist (precaching + runtime caching defaults).
5. Añade los meta tags necesarios para iOS (apple-touch-icon, apple-mobile-web-app-capable).
Valida con pnpm build que el service worker se genera. Documenta en docs/ESTADO.md cómo probar la instalación en un teléfono real.
```

**Validación:** `pnpm build` genera `sw.js`; Lighthouse marca la app como instalable; en Chrome Android aparece "Agregar a pantalla de inicio".

## F0.B3 — Layout mobile-first y navegación

**Prompt para Cowork:**

```text
Bloque F0.B3. Crea el esqueleto de navegación de la app:
1. Route group (app)/ con layout que incluye: header simple (nombre del negocio, placeholder por ahora) y bottom navigation bar fija con 5 ítems: Citas (/citas), Clientas (/clientas), Finanzas (/finanzas), Inventario (/inventario), Ajustes (/ajustes). Iconos de lucide-react, ítem activo resaltado, targets táctiles ≥48px, safe-area-inset-bottom para iPhone.
2. Página placeholder para cada ruta con su título y un estado vacío amigable.
3. Mobile-first: maquetado para 360–430px; en ≥768px el contenido se centra con max-width (la bottom-nav se mantiene, no inviertas tiempo en desktop).
4. Componente de página reutilizable (PageHeader con título y slot de acción).
Valida en viewport 390px: navegación entre las 5 secciones fluida, sin scroll horizontal, sin layout shift.
```

**Validación:** navegación completa en 390px sin defectos visuales; gate completo.

## F0.B4 — Base de datos y healthcheck

**Prompt para Cowork:**

```text
Bloque F0.B4. Configura la capa de datos:
1. Instala drizzle-orm, pg y drizzle-kit. Crea src/lib/db.ts (pool de pg + cliente Drizzle leyendo DATABASE_URL) y drizzle.config.ts apuntando a src/modules/**/schema.ts.
2. Crea src/modules/tenancy/schema.ts con la tabla tenants (id uuid pk default random, name text not null, phone text, timezone text default 'America/Bogota', currency text default 'COP', created_at timestamptz default now()).
3. Scripts: db:generate (drizzle-kit generate), db:migrate (drizzle-kit migrate), db:studio.
4. Crea src/app/api/health/route.ts: responde { ok: true, db: true|false } haciendo SELECT 1; status 503 si la DB no responde.
5. Crea src/lib/money.ts (formatCOP(bigint): string con Intl es-CO sin decimales; parseCOP(string): bigint tolerante a puntos y símbolo $) y src/lib/dates.ts (formatear fecha/hora en la TZ del tenant con date-fns y date-fns-tz). Escribe tests unitarios de ambos (casos: 0, montos grandes, entradas malformadas en parseCOP; cambio de TZ en dates).
6. Para desarrollo local documenta en README cómo levantar Postgres con Docker (docker compose con postgres:17) o usar la DB de Railway.
Valida: db:generate produce la migración, los tests de money/dates pasan, /api/health responde ok con la DB arriba.
```

**Validación:** migración generada y aplicada en local; tests de `money` y `dates` en verde (estos helpers tocan TODO el proyecto: la inversión en tests aquí paga siempre).

## F0.B5 — GitHub, CI y deploy en Railway

**Prompt para Cowork:**

```text
Bloque F0.B5. Deja el proyecto en producción:
1. Crea .github/workflows/ci.yml: en cada push a main corre install (pnpm con cache), lint, typecheck, test y build. Node 22.
2. Crea railway.json: build con pnpm build, start con pnpm start, healthcheck en /api/health, y un paso de migración (pnpm db:migrate) antes del start (usa el campo preDeployCommand).
3. Documenta en docs/DEPLOY.md el paso a paso manual que YO debo hacer: crear repo en GitHub y hacer push, crear proyecto en Railway con plugin Postgres, conectar el repo, setear variables (DATABASE_URL la inyecta Railway; BETTER_AUTH_SECRET generar con openssl rand -base64 32; BETTER_AUTH_URL = dominio público), activar deploy automático desde main.
4. Verifica que el build de producción local pasa antes de darme los pasos.
```

**Validación final de F0:** la URL pública de Railway carga la app, `/api/health` responde `{ok:true,db:true}`, CI en verde, PWA instalable desde el dominio público (HTTPS). **No avanzar a F1 sin esto.**

---

# FASE 1 — Autenticación y multi-tenancy

**Objetivo:** registro/login de manicuristas y aislamiento total de datos. Es la fase más crítica en seguridad: todo lo demás se construye encima.

## F1.B1 — Better Auth: registro y login

**Prompt para Cowork:**

```text
Bloque F1.B1. Implementa autenticación con Better Auth:
1. Instala better-auth. Configura en src/lib/auth.ts con adaptador Drizzle: email+password (mínimo 8 caracteres) y Google OAuth (deja las variables GOOGLE_CLIENT_ID/SECRET en .env.example y documenta en docs/DEPLOY.md cómo crear las credenciales en Google Cloud Console — el mismo proyecto de Google se reutilizará en la Fase 5 para Calendar).
2. Genera el schema de Better Auth (users, sessions, accounts, verifications) en src/modules/tenancy/auth-schema.ts y la migración.
3. Rutas (auth)/login y (auth)/registro: formularios mobile-first con shadcn/ui, validación Zod (email válido, password ≥8), errores en español bajo cada campo, estado de carga en el botón.
4. Middleware de Next.js: rutas del grupo (app)/ requieren sesión → redirect a /login; /login y /registro con sesión activa → redirect a /citas.
5. Botón de cerrar sesión en /ajustes.
6. Tests: unit de los schemas Zod; integration del flujo de registro (crear usuario → sesión activa) con una DB de test.
Email verification déjala desactivada por ahora (documentado como deuda en docs/DECISIONES.md).
```

**Validación:** registro → sesión → logout → login funcionan en móvil; no se puede acceder a /citas sin sesión (probar en ventana de incógnito).

## F1.B2 — Tenants y contexto de sesión

**Prompt para Cowork:**

```text
Bloque F1.B2. Implementa el modelo multi-tenant:
1. Tabla memberships (user_id, tenant_id, role enum 'owner'|'staff', unique(user_id, tenant_id)). Migración correspondiente.
2. src/modules/tenancy/context.ts: helper requireTenant() que (a) valida sesión, (b) obtiene el tenant del usuario, (c) devuelve { userId, tenantId, role } o lanza redirect a /login u /onboarding según el caso. Cachea por request con React cache().
3. Patrón repositorio: src/modules/tenancy/repository-base.ts documenta y exporta el patrón — toda función de repositorio recibe tenantId como PRIMER parámetro obligatorio.
4. Regla ESLint no-restricted-imports: prohibido importar src/lib/db.ts fuera de src/modules/**/repository.ts y de las migraciones. Mensaje del error: "Accede a datos solo vía repositorios de módulo".
5. Tests: requireTenant sin sesión → redirect; con sesión sin tenant → /onboarding; con tenant → datos correctos.
```

**Validación:** la regla de ESLint dispara si se importa `db` desde una página (probarlo y revertirlo); tests en verde.

## F1.B3 — Onboarding del negocio

**Prompt para Cowork:**

```text
Bloque F1.B3. Flujo de onboarding tras el primer registro:
1. Ruta (auth)/onboarding: formulario de un paso — nombre del negocio (requerido), teléfono WhatsApp del negocio (requerido, validar formato colombiano +57 3XX XXX XXXX con Zod, guardar normalizado E.164), zona horaria (select, default America/Bogota).
2. Server Action createTenant: crea tenant + membership owner en una transacción; redirect a /citas.
3. Usuario autenticado sin tenant que visite cualquier ruta de (app)/ → redirect a /onboarding (integrarlo en requireTenant).
4. El header del layout (app)/ muestra el nombre real del negocio.
5. Tests: la transacción crea ambas filas; si falla membership no queda tenant huérfano; un usuario con tenant que visita /onboarding es redirigido a /citas.
```

**Validación:** flujo completo registro → onboarding → app con nombre del negocio visible.

## F1.B4 — Tests de aislamiento multi-tenant

**Prompt para Cowork:**

```text
Bloque F1.B4. Blinda el aislamiento entre tenants ANTES de construir los módulos de negocio:
1. Helper de test src/test/tenancy.ts: crea dos tenants (A y B) con un usuario cada uno, contra la DB de test.
2. Suite de integración "tenant isolation": por ahora prueba la tabla tenants/memberships; deja el patrón documentado para que CADA módulo futuro (clientas, citas, finanzas, inventario) añada aquí sus casos: listar como A no devuelve filas de B; leer por id un recurso de B siendo A → not found; mutar un recurso de B siendo A → error y la fila no cambia.
3. Documenta en docs/TESTING.md: cómo correr los tests, cómo funciona la DB de test (schema recreado por suite con drizzle), y la REGLA: ningún módulo de negocio se da por terminado sin sus tests de aislamiento en esta suite.
4. Añade el job de tests de integración al CI (puede usar un servicio de Postgres en GitHub Actions).
```

**Validación final de F1:** CI corre tests de integración con Postgres real; suite de aislamiento en verde; deploy en Railway actualizado y el flujo completo probado en producción con dos cuentas reales.

---

# FASE 2 — Clientas y servicios

**Objetivo:** los dos catálogos maestros que las citas necesitan. Patrón CRUD que se reutilizará en todo el proyecto.

## F2.B1 — Módulo de clientas

**Prompt para Cowork:**

```text
Bloque F2.B1. Implementa el módulo de clientas en src/modules/clients/:
1. schema.ts: tabla clients (id uuid, tenant_id fk not null, name text not null, phone text not null — formato E.164, email opcional, notes text opcional, created_at, archived_at timestamptz null). Índice (tenant_id, name). Migración.
2. repository.ts: listClients(tenantId, {search?}), getClient(tenantId, id), createClient, updateClient, archiveClient (soft delete: pone archived_at; las clientas NO se borran porque las citas históricas las referencian), restoreClient. Toda función filtra por tenant_id.
3. actions.ts: Server Actions con Zod (nombre ≥2 chars; teléfono colombiano normalizado a E.164; email válido si viene). Patrón {ok, data|error}.
4. UI en /clientas: lista con búsqueda por nombre/teléfono (input con debounce), tarjetas con nombre + teléfono + botón de llamar/WhatsApp (links tel: y wa.me), botón flotante "+" para crear, hoja (sheet) de creación/edición mobile-first, vista de detalle con notas y espacio reservado "Historial de citas" (se llena en F3), opción archivar con confirmación y sección colapsada de archivadas.
5. Estados vacíos: sin clientas → ilustración simple + CTA "Registra tu primera clienta".
6. Tests: unit de schemas Zod (teléfonos: 3001234567, +573001234567, 300 123 4567 → +573001234567; rechazar fijos y extranjeros con mensaje claro); integración del repositorio (CRUD + búsqueda) y casos de aislamiento A/B añadidos a la suite de F1.B4.
```

**Validación:** crear/editar/buscar/archivar desde un móvil real o viewport 390px; tests de aislamiento de clientas en verde.

## F2.B2 — Catálogo de servicios

**Prompt para Cowork:**

```text
Bloque F2.B2. Implementa el módulo de servicios en src/modules/services/:
1. schema.ts: tabla services (id uuid, tenant_id fk, name text not null, base_price_cop bigint not null ≥0, duration_min int not null >0, active boolean default true, created_at). Índice (tenant_id, active). Migración.
2. repository.ts + actions.ts siguiendo exactamente el patrón de clients (lista activos/inactivos, crear, editar, desactivar — no borrar).
3. UI en /ajustes/servicios (entrada desde la página de Ajustes): lista con nombre, precio formateado con formatCOP y duración; crear/editar en sheet; el input de precio usa un componente MoneyInput que formatea es-CO mientras se escribe (50000 → $50.000) y entrega bigint — este componente vivirá en components/ y se reutilizará en citas.
4. Seed opcional en el onboarding: al crear el tenant, ofrecer crear servicios típicos de ejemplo (manicure tradicional, semipermanente, acrílicas, pedicure) que la usuaria puede editar. Hazlo como checkbox "crear servicios de ejemplo" marcado por defecto.
5. Tests: Zod (precio negativo rechazado, duración 0 rechazada), MoneyInput (unit con testing-library), repositorio + aislamiento A/B.
```

**Validación final de F2:** una usuaria nueva puede registrarse, pasar onboarding con servicios de ejemplo, registrar clientas y ajustar su catálogo, todo desde el teléfono, en producción. Gate completo + commit.

---

# FASE 3 — Citas (núcleo del producto)

**Objetivo:** el corazón de la app. Se divide en 5 bloques porque es la fase más grande; no intentar hacerla en un solo chat.

## F3.B1 — Modelo de datos de citas y auditoría

**Prompt para Cowork:**

```text
Bloque F3.B1. SOLO modelo de datos y repositorio de citas (la UI viene en los bloques siguientes), en src/modules/appointments/:
1. schema.ts: 
   - appointments: id uuid, tenant_id fk, client_id fk not null, starts_at timestamptz not null, ends_at timestamptz not null, status enum ('scheduled','completed','cancelled','no_show') default scheduled, payment_status enum ('pending','partial','paid') default pending, total_cop bigint not null default 0, paid_cop bigint not null default 0, people_count int not null default 1, notes text, public_token uuid not null unique default random, gcal_event_id text null, created_at, updated_at. Índices: (tenant_id, starts_at) y unique(public_token).
   - appointment_services: appointment_id fk on delete cascade, service_id fk, price_cop bigint not null (precio congelado), quantity int default 1. PK compuesta (appointment_id, service_id).
   - appointment_changes: id, appointment_id fk, changed_by (user id), changed_at default now, field text, old_value text, new_value text.
2. repository.ts: createAppointment (cita + servicios en transacción; total_cop = suma de servicios salvo override explícito), getAppointment (con cliente y servicios via joins), listAppointmentsByDay(tenantId, date, tz), listAppointmentsByRange, updateAppointment (transacción que: aplica cambios, recalcula total si cambian servicios y no hay override, y escribe UNA fila en appointment_changes POR CADA campo modificado con valores legibles — p.ej. para dinero "50000"), registerPayment(tenantId, id, amount) que suma a paid_cop y deriva payment_status (0=pending, <total=partial, ≥total=paid), cancelAppointment, getAppointmentHistory.
3. Reglas de dominio en src/modules/appointments/domain.ts (funciones puras, sin DB): derivePaymentStatus(total, paid), computeTotal(servicios, override?), validateTimeRange(starts, ends). 
4. Tests EXHAUSTIVOS de domain.ts y del repositorio: creación con varios servicios, edición que recalcula total, override manual de total que NO se pisa al editar otra cosa, pagos parciales acumulados, historial con una fila por campo cambiado, solapamiento de fechas en listByDay con TZ America/Bogota (citas a las 23:00 caen en el día correcto), y aislamiento A/B en la suite de F1.B4.
No hagas UI en este bloque.
```

**Validación:** suite del bloque en verde; revisar a mano la migración SQL generada antes de aplicarla.

## F3.B2 — Crear cita

**Prompt para Cowork:**

```text
Bloque F3.B2. Flujo de creación de cita, optimizado para hacerse en menos de 30 segundos desde el teléfono:
1. Botón "+" prominente en /citas → ruta /citas/nueva (página, no modal: el flujo es largo para un modal en móvil).
2. Formulario por secciones en una sola página con scroll:
   a. Clienta: buscador con autocompletado sobre las clientas existentes + atajo "crear clienta nueva" inline (nombre y teléfono mínimos, sheet sin salir del flujo).
   b. Servicios: lista de servicios activos como chips/cards seleccionables multi-select con cantidad (para "2 manos acrílicas" o varias personas); muestra el subtotal en vivo con formatCOP.
   c. Fecha y hora: selector de fecha (default hoy) y hora con pasos de 15 min; duración sugerida = suma de duration_min de los servicios (editable); ends_at se calcula.
   d. Monto: total calculado, editable con MoneyInput (override); people_count (stepper 1–10); notas opcionales.
   e. Estado de pago inicial: pendiente (default) / pagada / abono con monto.
3. Server Action createAppointment usando el repositorio de F3.B1. Al guardar → redirect al detalle de la cita con toast de éxito.
4. Validaciones con mensajes en español: clienta requerida, ≥1 servicio, fecha/hora válidas, advertencia (no bloqueo) si se solapa con otra cita existente — mostrar con cuál.
5. Tests: integración de la action (happy path, solape advertido, clienta inline creada en la misma transacción); E2E Playwright del flujo completo contra la app local.
```

**Validación:** crear una cita real en producción desde el teléfono en <30s; la advertencia de solape aparece cuando corresponde.

## F3.B3 — Agenda (vista principal)

**Prompt para Cowork:**

```text
Bloque F3.B3. /citas se convierte en la agenda, la pantalla principal de la app:
1. Vista por día (default hoy): lista cronológica de citas como tarjetas — hora inicio-fin, nombre de la clienta, servicios resumidos, total con formatCOP, badge de payment_status (pendiente=ámbar, abono=azul, pagada=verde) y badge de status si no es scheduled.
2. Navegación de fechas: header con fecha legible en español ("miércoles 10 de junio"), flechas ←/→ para día anterior/siguiente, botón "Hoy", y tira horizontal de 7 días deslizable con indicador de cuántas citas tiene cada día.
3. Tab "Semana": lista agrupada por día de los próximos 7 días (no grid de calendario: en 390px no funciona).
4. Resumen del día arriba: "N citas · $X total · $Y pendiente".
5. Tap en tarjeta → /citas/[id] (el detalle se construye en F3.B4; por ahora página básica con los datos).
6. Estados: día sin citas → mensaje amigable + CTA crear; loading con skeletons.
7. Server Component con datos del repositorio; revalidación correcta tras crear/editar (revalidatePath).
8. Tests: E2E de navegación entre días y aparición de la cita creada; unit del agrupador por día con TZ del tenant.
```

**Validación:** agenda usable y rápida en el teléfono; los números del resumen cuadran con las citas visibles.

## F3.B4 — Detalle y edición en vivo (RF-02, crítico)

**Prompt para Cowork:**

```text
Bloque F3.B4. Detalle de cita /citas/[id] con edición en vivo — durante la cita cambian servicios, precios y personas, y la app debe acompañar eso sin fricción:
1. Detalle: clienta (con link a su ficha y botón WhatsApp), fecha/hora, lista de servicios con precio congelado y cantidad, people_count, total, pagado, saldo pendiente, estado, notas.
2. Edición inline por secciones (cada una con su sheet): 
   - Servicios: añadir/quitar/cambiar cantidad; el total se recalcula salvo que haya override manual activo (mostrar aviso "total editado manualmente" con opción de volver al calculado).
   - Total: editable con MoneyInput (override).
   - Fecha/hora, people_count, notas: editables.
   - Pago: botón "Registrar pago" → sheet con monto (default el saldo) → registerPayment; mostrar lista de pagos implícita vía historial.
3. Acciones de estado: marcar completada, no asistió, cancelar (con confirmación). Citas cancel/completadas quedan de solo lectura excepto el pago.
4. Sección "Historial de cambios" colapsada: lee appointment_changes y muestra "10 jun 3:45pm — total: $50.000 → $65.000" en español legible.
5. Toda mutación usa las Server Actions/repositorio de F3.B1 (que ya escriben auditoría). Optimistic UI donde sea barato; si la action falla, revertir y toast de error.
6. Tests: E2E del flujo "cita en curso": añadir un servicio, subir el total a mano, registrar abono, completar la cita, verificar historial. Integración: cita completada rechaza edición de servicios pero acepta pago.
```

**Validación:** simular una cita real de punta a punta en producción (crear → editar en medio → abonar → completar) y revisar que el historial cuente la historia completa.

## F3.B5 — Ficha de clienta con historial

**Prompt para Cowork:**

```text
Bloque F3.B5. Cierra el círculo clienta↔citas:
1. En el detalle de clienta (F2.B1) llena la sección "Historial": citas pasadas y futuras. Añade al repositorio de appointments la función listAppointmentsByClient(tenantId, clientId, {page}) con paginación y orden descendente por starts_at. Cada cita con fecha, servicios, total y estado de pago.
2. Totales de la clienta: cuántas citas, total histórico pagado, saldo pendiente acumulado (suma de citas con saldo).
3. Botón "Nueva cita" desde la ficha que llega a /citas/nueva con la clienta preseleccionada (searchParam).
4. Tests: repositorio (orden y paginación), aislamiento A/B, E2E breve.
```

**Validación final de F3:** una manicurista puede operar su día completo solo con la app: ver agenda, crear citas, editarlas en vivo, cobrar y consultar el historial de cada clienta. **Esta es la primera versión genuinamente útil del producto — probarla varios días en uso real antes de seguir, y anotar fricciones en docs/FEEDBACK.md.**

---

# FASE 4 — Compartir citas con las clientas

**Objetivo:** que la clienta tenga presente su cita sin instalar nada: página pública + mensaje de WhatsApp personalizado + evento de calendario.

## F4.B1 — Página pública de cita

**Prompt para Cowork:**

```text
Bloque F4.B1. Página pública por cita en src/app/(public)/cita/[token]/:
1. Ruta SIN autenticación que resuelve la cita por public_token (uuid, ya existe en el schema). Token inválido o cita cancelada → página "Esta cita ya no está disponible" sin filtrar información.
2. Contenido (solo lectura, CERO datos sensibles): nombre del negocio, nombre de pila de la clienta ("¡Hola María!"), fecha y hora en español legible ("miércoles 10 de junio, 3:00 pm"), servicios, y dirección/nota pública del negocio si existe (añade campo public_address y public_note a tenants con su migración y edición en /ajustes). NO mostrar precios ni teléfono de la clienta — decisión de privacidad: la página puede reenviarse.
3. Diseño cuidado mobile-first con la identidad de CatApp: esta página ES el marketing del producto. Botón "Agregar a mi calendario" (lo implementa F4.B3, deja el placeholder) y botón "Escribir a [negocio]" con wa.me al teléfono del tenant.
4. Si la cita cambia de fecha/hora, la página refleja siempre el estado actual (sin caché o con revalidación corta).
5. SEO/robots: noindex.
6. En el detalle de cita interno (F3.B4) añade botón "Compartir" que copia el link público (navigator.share con fallback a clipboard).
7. Tests: integración (token válido muestra, inválido 404 amigable, cancelada no muestra detalles); E2E del flujo compartir.
```

**Validación:** abrir el link en un navegador sin sesión y en otro teléfono; verificar que NO hay forma de llegar a datos de otros ni ver precios.

## F4.B2 — Mensajes de WhatsApp con wa.me

**Prompt para Cowork:**

```text
Bloque F4.B2. Mensajería manual por WhatsApp (sin API de Meta todavía) en src/modules/whatsapp/:
1. templates.ts: funciones puras que generan textos en español cálido y profesional con los datos de la cita. Plantillas: confirmación de cita nueva, recordatorio (para enviar el día anterior), reagendamiento (incluye fecha vieja y nueva), agradecimiento post-cita. Todas terminan incluyendo el link público de F4.B1. Variables: nombre de pila, negocio, fecha/hora legible, servicios.
2. buildWaLink(phoneE164, text): genera https://wa.me/<phone>?text=<encoded>. Cuida el límite de longitud de URL y el encoding de emojis/saltos de línea.
3. UI en el detalle de cita: botón "Enviar WhatsApp" → sheet con las plantillas aplicables según el estado de la cita, preview del texto editable, y botón que abre wa.me. 
4. En /ajustes, sección "Mensajes": el tenant puede personalizar el texto base de cada plantilla (tabla message_templates con defaults; placeholders {clienta}, {fecha}, {hora}, {servicios}, {negocio}, {link} documentados en la UI).
5. Tests: unit de cada plantilla (render de placeholders, fechas en español, encoding del link wa.me con tildes y emojis); integración de plantillas personalizadas por tenant + aislamiento.
```

**Validación:** enviar un WhatsApp real a un número propio desde el detalle de una cita; el texto llega bien formateado y el link funciona.

## F4.B3 — Archivo .ics (calendario de la clienta)

**Prompt para Cowork:**

```text
Bloque F4.B3. Evento de calendario descargable:
1. Ruta /cita/[token]/evento.ics: genera el archivo iCalendar (RFC 5545) de la cita — UID estable (id de cita), DTSTART/DTEND en UTC, SUMMARY "Cita en {negocio}", DESCRIPTION con servicios y link público, LOCATION con public_address si existe. Content-Type text/calendar. Genera el .ics a mano o con la librería 'ics' (elige y documenta).
2. Conecta el botón "Agregar a mi calendario" de F4.B1: en iOS abre el .ics directo; añade también link "Google Calendar" (URL render template de calendar.google.com) para Android.
3. Si la cita se reagenda, el mismo UID con SEQUENCE incrementado permite que el calendario la actualice (guarda sequence int en appointments, increméntalo al cambiar starts_at).
4. Tests: unit del generador (formato, escapes, UTC correcto desde America/Bogota, sequence); validar el archivo con un parser ics en el test.
```

**Validación final de F4:** flujo real completo: crear cita → enviar WhatsApp → abrir link como clienta → agregar al calendario del teléfono → reagendar → reenviar → el evento se actualiza.

---

# FASE 5 — Google Calendar (manicurista)

**Objetivo:** las citas de CatApp aparecen en el Google Calendar de la manicurista automáticamente, con invitación opcional a la clienta.

> **Prerrequisito manual (Susana):** en Google Cloud Console, sobre el MISMO proyecto OAuth de F1.B1, habilitar la API de Google Calendar y añadir el scope `https://www.googleapis.com/auth/calendar.events`. Mientras la app esté en modo "Testing" solo funcionan cuentas registradas como test users; documentado en docs/DEPLOY.md.

## F5.B1 — Conexión OAuth y almacenamiento de tokens

**Prompt para Cowork:**

```text
Bloque F5.B1. Conexión de Google Calendar en src/modules/calendar/:
1. Flujo OAuth incremental independiente del login (la usuaria pudo registrarse con email): en /ajustes, tarjeta "Google Calendar" con botón Conectar → consent de Google con scope calendar.events y access_type=offline + prompt=consent (para obtener refresh_token) → callback /api/google/callback.
2. Tabla google_accounts (id, tenant_id unique, google_email, refresh_token ENCRIPTADO con AES-256-GCM — clave en env GOOGLE_TOKEN_KEY, helper en lib/crypto.ts con tests —, calendar_id default 'primary', sync_enabled boolean default true, created_at). Migración.
3. client.ts: getCalendarClient(tenantId) que refresca el access token con el refresh token (usa googleapis o llamadas REST directas, elige y documenta). Manejo de revocación: si Google devuelve invalid_grant, marcar la conexión como rota y mostrar "Reconectar" en /ajustes.
4. UI /ajustes: estado conectado (email de Google, calendario destino seleccionable entre los calendarios del usuario, toggle de sync) / desconectado / roto. Desconectar borra la fila y revoca el token contra Google.
5. Tests: unit de crypto (round-trip, claves distintas fallan); integración del guardado/lectura de la conexión con token cifrado; mock del refresh.
```

**Validación:** conectar una cuenta real de Google desde producción; el refresh_token queda cifrado en DB (verificar en psql que no se lee en claro).

## F5.B2 — Sincronización de citas

**Prompt para Cowork:**

```text
Bloque F5.B2. Sync CatApp → Google Calendar:
1. sync.ts: syncAppointment(tenantId, appointmentId) — si el tenant tiene conexión activa: crear evento (guardar gcal_event_id), actualizarlo si ya existe, borrarlo si la cita se cancela. Evento: summary "💅 {clienta} — {servicios}", horas correctas con timeZone America/Bogota (la del tenant), description con link al detalle interno.
2. Engancha la sync DESPUÉS de cada mutación de cita (crear/editar/cancelar) de forma no bloqueante: la action responde a la usuaria sin esperar a Google (usa after() de Next 15) y los errores de sync se guardan en una columna gcal_sync_status (ok|pending|error) visible discretamente en el detalle de la cita con botón "Reintentar".
3. Idempotencia: si gcal_event_id existe usa update; si Google responde 404 (evento borrado a mano), crea uno nuevo.
4. Botón en /ajustes "Sincronizar citas futuras" que recorre las citas scheduled sin gcal_event_id (backfill tras conectar).
5. Invitación a la clienta (RF-06): checkbox opcional "invitar a la clienta por correo" en crear/editar cita, visible solo si la clienta tiene email; añade attendee y Google envía la invitación (sendUpdates=all).
6. Tests: unit de la construcción del evento (TZ, attendees); integración de la máquina de estados de sync con el cliente de Google mockeado (crear→editar→cancelar, 404→recrear, error→status error).
```

**Validación final de F5:** crear/editar/cancelar citas en producción y verlas reflejadas en Google Calendar en segundos; desconectar Google y comprobar que la app sigue funcionando sin errores visibles.

---

# FASE 6 — Finanzas

**Objetivo:** responder "¿cuánto gané este mes?" con precisión y de un vistazo (RF-07).

## F6.B1 — Consultas financieras

**Prompt para Cowork:**

```text
Bloque F6.B1. Capa de datos financiera en src/modules/finance/ (sin UI):
1. NO crees tablas nuevas: las finanzas se DERIVAN de appointments (fuente de verdad única, sin duplicación que se desincronice). repository.ts con queries agregadas:
   - monthlySummary(tenantId, year, month, tz): { totalFacturado (citas completed del mes), totalCobrado (paid_cop), totalPendiente, citasCount, por las fronteras del mes EN LA TZ DEL TENANT (cuidado: un mes en America/Bogota no es un mes en UTC) }.
   - byService(tenantId, year, month): desglose por servicio (joins con appointment_services) con cantidad y total.
   - byClient(tenantId, year, month): top clientas por facturación.
   - pendingPayments(tenantId): citas con saldo > 0 de cualquier fecha, ordenadas por antigüedad.
   - dailySeries(tenantId, year, month): total por día para el gráfico.
2. Decisiones de negocio (documéntalas en docs/DECISIONES.md): una cita cuenta como ingreso del mes de su starts_at cuando status=completed; las canceladas/no_show no suman facturación, pero si tienen paid_cop > 0 (anticipos no devueltos) aparecen en una línea aparte "otros ingresos".
3. Todas las queries con SQL agregado en Drizzle (sum/count/group by), NUNCA trayendo todas las filas a JS.
4. Tests exhaustivos con dataset sembrado: citas en fronteras de mes (31 jul 11pm Bogotá), estados mezclados, pagos parciales, anticipos de canceladas, mes vacío. Verificar contra totales calculados a mano en el test. Aislamiento A/B.
```

**Validación:** los números de los tests cuadran a mano; revisar el SQL generado (EXPLAIN) y confirmar que usa los índices (tenant_id, starts_at).

## F6.B2 — Dashboard de finanzas

**Prompt para Cowork:**

```text
Bloque F6.B2. UI en /finanzas:
1. Selector de mes (← mes año →, default actual, sin futuro más allá del mes corriente).
2. Tarjetas resumen: Total del mes (grande, protagonista), Cobrado, Pendiente, # citas. Comparación discreta vs mes anterior (↑12%).
3. Gráfico de barras por día del mes (recharts o un SVG propio liviano — elige por peso del bundle y documenta; mobile-first, sin tooltips imposibles de tocar).
4. Desglose por servicio (lista: servicio, cantidad, total) y top 5 clientas del mes.
5. Sección "Pagos pendientes" (todas las fechas): clienta, fecha de la cita, saldo, tap → detalle de la cita para cobrar; total acumulado pendiente visible.
6. Export CSV del mes: route handler /api/finanzas/export?year&month que genera CSV (fecha, clienta, servicios, total, pagado, saldo, estado) con BOM UTF-8 para que Excel lo abra bien; botón "Descargar CSV".
7. Tests: E2E del dashboard con datos sembrados (los números visibles = los esperados); unit del generador CSV (escapes de comas/comillas/tildes, BOM).
```

**Validación final de F6:** con un mes de datos reales/sembrados, el total mostrado coincide con la suma manual de las citas; el CSV abre limpio en Excel; todo legible en 390px.

---

# FASE 7 — Inventario

**Objetivo:** control simple de stock con alertas (RF-08). Independiente de F3–F6; puede adelantarse si otra fase se bloquea.

## F7.B1 — Modelo de inventario

**Prompt para Cowork:**

```text
Bloque F7.B1. Modelo de datos en src/modules/inventory/ (sin UI):
1. schema.ts: products (id, tenant_id, name not null, unit text default 'unidad' — valores típicos: unidad, ml, gr, par —, stock numeric(12,2) not null default 0, min_stock numeric(12,2) default 0, cost_cop bigint null, active boolean default true, created_at) con índice (tenant_id, active); stock_movements (id, tenant_id, product_id fk, type enum 'in'|'out'|'adjust', quantity numeric(12,2) — para adjust guarda el DELTA aplicado, no el valor final —, reason text null, created_by, created_at) con índice (tenant_id, product_id, created_at). Migración.
2. repository.ts: el stock SOLO cambia vía registerMovement (transacción: inserta movimiento + UPDATE products SET stock = stock + delta con guarda stock + delta >= 0, si no → error "stock insuficiente"). createProduct (stock inicial → movimiento 'in' inicial), updateProduct (datos, no stock), deactivateProduct, listProducts(tenantId, {lowStockOnly?}), listMovements(tenantId, productId, paginado), lowStockCount(tenantId).
3. domain.ts puro: isLowStock(stock, minStock).
4. Tests: concurrencia (dos salidas simultáneas no dejan stock negativo — test con transacciones paralelas), adjust con delta negativo y positivo, historial íntegro (sum de movimientos = stock actual, verificado en test), aislamiento A/B.
```

**Validación:** suite en verde, incluida la prueba de concurrencia y la invariante suma-de-movimientos = stock.

## F7.B2 — UI de inventario y alertas

**Prompt para Cowork:**

```text
Bloque F7.B2. UI en /inventario:
1. Lista de productos: nombre, stock con unidad, badge rojo "stock bajo" si stock ≤ min_stock; filtro "solo stock bajo"; buscador.
2. Acciones rápidas EN la tarjeta (sin navegar): botones −/+ que abren un mini-sheet "Salida/Entrada" con cantidad (default 1) y motivo opcional → registerMovement. Optimistic UI.
3. Crear/editar producto en sheet: nombre, unidad (select), stock inicial (solo al crear), stock mínimo, costo opcional con MoneyInput.
4. Detalle del producto: historial de movimientos paginado (fecha, tipo en español — Entrada/Salida/Ajuste —, cantidad, motivo) y acción "Ajustar stock" (ingresa el valor REAL contado y el sistema calcula el delta como movimiento adjust con motivo obligatorio).
5. Alerta global: badge con lowStockCount en el ítem Inventario de la bottom-nav cuando > 0.
6. Tests: E2E (crear producto → salidas hasta el mínimo → aparece alerta y badge → ajuste corrige); unit del cálculo de delta en ajustes.
```

**Validación final de F7:** gestionar productos reales (esmaltes, limas) una semana; el badge de alerta corresponde a la realidad; el historial explica cualquier número de stock.

---

# FASE 8 — WhatsApp Cloud API (recordatorios automáticos)

**Objetivo:** mensajes automáticos sin intervención de la manicurista (RF-09). Es la fase con más dependencias externas: hacerla al final minimiza el riesgo.

> **Prerrequisitos manuales (Susana), documentar avance en docs/DEPLOY.md:**
> 1. Cuenta Meta Business verificada + app en developers.facebook.com con el producto WhatsApp.
> 2. Número de teléfono dedicado para el remitente (no puede ser un número ya usado en WhatsApp personal/Business app).
> 3. Plantillas de mensaje aprobadas por Meta (la aprobación tarda horas–días). Costo por conversación según tarifas de Meta para Colombia.
> 4. Decisión de producto: en el modelo SaaS, el remitente es un número de CatApp (las clientas reciben "CatApp en nombre de {negocio}"). Que cada tenant conecte su propio número Meta es posible pero queda fuera de alcance (deuda documentada).

## F8.B1 — Infraestructura de envío y webhook

**Prompt para Cowork:**

```text
Bloque F8.B1. Integración con WhatsApp Cloud API en src/modules/whatsapp/ (amplía el módulo de F4.B2):
1. cloud-api.ts: cliente de la Graph API — sendTemplate(toE164, templateName, variables) contra /<PHONE_NUMBER_ID>/messages con el token en env (WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_VERIFY_TOKEN, WA_APP_SECRET). Manejo de errores tipado (número inválido, plantilla no aprobada, rate limit) sin exponer detalles de Meta a la UI.
2. Tabla wa_messages (id, tenant_id, appointment_id fk null, to_phone, template_name, status enum 'queued'|'sent'|'delivered'|'read'|'failed', wa_message_id text null, error text null, created_at, updated_at). Migración. TODO envío pasa por aquí: primero fila queued, luego update según respuesta.
3. Webhook /api/whatsapp/webhook: GET de verificación (hub.challenge con WA_VERIFY_TOKEN) y POST de estados — VALIDA la firma X-Hub-Signature-256 con WA_APP_SECRET, actualiza wa_messages por wa_message_id, responde 200 rápido siempre.
4. Feature flag: si las env de WhatsApp no están configuradas, todo este módulo queda inerte (la app funciona igual que en F4).
5. Tests: unit del cliente con fetch mockeado (payload correcto por plantilla, errores mapeados); unit de la validación de firma (firma buena/mala/ausente); integración del ciclo queued→sent→delivered vía webhook simulado.
```

**Validación:** con el número de prueba de Meta (gratuito), enviar una plantilla real a tu teléfono y ver el estado llegar a `delivered` en la tabla vía webhook (usar la URL de Railway).

## F8.B2 — Recordatorios programados

**Prompt para Cowork:**

```text
Bloque F8.B2. Automatización de recordatorios:
1. Route handler /api/cron/reminders protegido con header Authorization: Bearer CRON_SECRET (env). Lógica: buscar citas scheduled cuyo starts_at esté entre 20 y 28 horas en el futuro (ventana amplia para tolerar fallos del cron) sin recordatorio previo (consulta wa_messages por appointment_id + template), y enviar la plantilla de recordatorio con los datos de la cita y el link público. Marca idempotente: el mismo recordatorio jamás se envía dos veces aunque el cron corra cada hora.
2. Configura el cron en Railway (railway.json o servicio cron) cada hora. Documenta la alternativa GitHub Actions schedule como fallback en docs/DEPLOY.md.
3. Confirmación inmediata: al CREAR una cita (F3.B2), si WhatsApp API está activa, enviar también la plantilla de confirmación automáticamente (no bloqueante, con after()). Toggle por tenant en /ajustes: "Enviar confirmaciones y recordatorios automáticos" (default on) — respétalo en ambos envíos.
4. Visibilidad: en el detalle de la cita, línea de estado "Recordatorio enviado ✓ (leído)" leyendo wa_messages.
5. Opt-out por clienta: campo wa_opt_out boolean en clients + toggle en su ficha; los envíos automáticos lo respetan (los manuales wa.me de F4 no, porque los envía la manicurista desde su teléfono).
6. Tests: integración del cron con tiempo simulado (cita a 24h → envía; a 3h → no; ya enviado → no repite; opt-out → no envía; toggle del tenant off → no envía); unit de la ventana horaria con TZ.
```

**Validación final de F8:** cita real creada → confirmación llega sola; al día siguiente (o ajustando la ventana en test) → recordatorio llega solo; estados visibles en la app; desactivar el toggle y verificar silencio.

---

# FASE 9 — PWA avanzada, rendimiento y pulido

**Objetivo:** que la app se sienta nativa y aguante red mala (RNF-01, RNF-02).

## F9.B1 — Offline y experiencia de instalación

**Prompt para Cowork:**

```text
Bloque F9.B1. Mejora la PWA de F0.B2:
1. Estrategias de caché en sw.ts: app shell precacheado; páginas de datos con NetworkFirst y fallback a caché (ver la agenda de hoy sin señal); estáticos con CacheFirst. Página /offline amigable para rutas nunca cacheadas.
2. Indicador de conexión: banner discreto "Sin conexión — mostrando datos guardados" cuando navigator.onLine es false.
3. Las MUTACIONES offline NO se encolan (fuera de alcance, documentar como deuda): si no hay red al guardar, error claro "Sin conexión, intenta de nuevo" sin perder lo escrito en el formulario.
4. Experiencia de instalación: en /ajustes, tarjeta "Instala CatApp" con instrucciones por plataforma (detecta iOS vs Android) y prompt beforeinstallprompt en Android.
5. Actualización del SW: toast "Hay una nueva versión — Actualizar" cuando hay SW en waiting.
6. Tests: E2E con Playwright en modo offline (context.setOffline): la agenda cacheada se muestra, la página /offline aparece en rutas no cacheadas.
```

## F9.B2 — Rendimiento y accesibilidad

**Prompt para Cowork:**

```text
Bloque F9.B2. Auditoría y corrección:
1. Corre Lighthouse (móvil, 4G simulado) sobre las 5 secciones principales en el build de producción. Meta: Performance ≥90, Accessibility ≥95, Best Practices ≥95. Lista los hallazgos ANTES de corregir y muéstramelos.
2. Optimiza lo que aparezca: bundle (analiza con @next/bundle-analyzer; saca librerías pesadas de Client Components), imágenes con next/image, fuentes con next/font, dynamic imports para sheets/gráficos.
3. Accesibilidad: auditoría con axe (instala @axe-core/playwright y añade asserts a los E2E existentes): labels, contraste, orden de foco, roles en la bottom-nav, aria-live en toasts.
4. Revisa los estados de carga de TODAS las pantallas: skeletons consistentes, sin saltos de layout (CLS ≈ 0).
5. Documenta los números antes/después en docs/PERFORMANCE.md.
```

## F9.B3 — Suite E2E completa y regresión

**Prompt para Cowork:**

```text
Bloque F9.B3. Consolidación de tests E2E en e2e/:
1. Revisa los E2E creados en F2–F8 y organízalos en un recorrido coherente: smoke (registro→onboarding→crear clienta→crear cita→cobrar→ver finanzas→mover inventario) + specs por módulo.
2. Añade los flujos no cubiertos aún: edición en vivo completa, compartir link público, export CSV, opt-out de WhatsApp.
3. Playwright config: proyecto mobile (iPhone 14 viewport) como principal, chromium desktop secundario; trace on-first-retry.
4. Integra E2E al CI como job aparte (con Postgres de servicio y build de producción). Si tarda >10 min, divide en shards.
5. docs/TESTING.md actualizado: pirámide de tests del proyecto, cómo correr cada nivel, política (qué exige cada bloque futuro).
```

**Validación final de F9:** CI completo (lint, types, unit, integration, E2E) en verde en <15 min; Lighthouse cumple metas; la app funciona en un teléfono Android de gama media con red 3G real.

---

# FASE 10 — Hardening, operación y lanzamiento

**Objetivo:** lista para usuarias reales que pagan con su confianza.

## F10.B1 — Seguridad

**Prompt para Cowork:**

```text
Bloque F10.B1. Revisión de seguridad integral. Ejecuta esta auditoría y corrige lo encontrado:
1. Recorre TODAS las Server Actions y route handlers y verifica la tríada: sesión válida → pertenencia al tenant → input Zod. Haz una tabla en docs/SECURITY.md con cada endpoint y su estado.
2. Headers de seguridad en next.config: CSP (ajustada, sin unsafe-eval), X-Frame-Options DENY (excepto si rompe algo documentado), Referrer-Policy, Permissions-Policy mínima.
3. Rate limiting en endpoints sensibles (login, registro, página pública por token, webhook): implementa con un token bucket en memoria por instancia + descripción de cómo migrar a Redis si se escala (documenta el trade-off).
4. Enumeración de tokens públicos: confirma que public_token es uuid v4 random (122 bits) y que la respuesta para token inexistente es idéntica en tiempo y contenido a cancelada.
5. Dependencias: pnpm audit, corrige o documenta excepciones; activa Dependabot/Renovate en el repo.
6. Secretos: greppea el repo completo buscando posibles secretos hardcodeados; verifica que .env nunca se commiteó (git log).
7. Repasa OWASP Top 10 punto por punto en docs/SECURITY.md indicando cómo está cubierto cada uno en esta app.
```

## F10.B2 — Operación: backups, monitoreo, errores

**Prompt para Cowork:**

```text
Bloque F10.B2. Operación:
1. Backups: verifica/documenta los backups automáticos de Postgres en Railway; añade a docs/RUNBOOK.md el procedimiento de restauración PROBADO (hacer un restore de prueba a una DB temporal y documentar los comandos exactos).
2. Errores en producción: integra Sentry (@sentry/nextjs) con DSN en env, source maps, y filtrado de datos sensibles (sin teléfonos ni nombres en los eventos). Alerta por email en errores nuevos.
3. Logging estructurado: reemplaza console.log sueltos por un logger mínimo (pino o consola estructurada) con tenant_id en el contexto (NUNCA datos personales).
4. Uptime: configura el healthcheck de Railway + un monitor externo gratuito (UptimeRobot o similar — dame el paso a paso manual) sobre /api/health.
5. docs/RUNBOOK.md: qué hacer si la app está caída, si la DB está llena, si Google/Meta revocan tokens, cómo leer los logs en Railway, cómo hacer rollback de un deploy.
```

## F10.B3 — Checklist de lanzamiento

**Prompt para Cowork:**

```text
Bloque F10.B3. Cierre:
1. Recorre docs/ESTADO.md y verifica que todos los bloques estén completados con sus gates; lista cualquier deuda técnica documentada y clasifícala (bloqueante / post-lanzamiento).
2. Dominio propio: documenta cómo apuntar un dominio a Railway (CNAME) y actualizar BETTER_AUTH_URL y los redirect URIs de Google/Meta.
3. Datos legales mínimos: página /privacidad y /terminos (plantilla simple en español adaptada a una app que guarda nombres y teléfonos de clientas en Colombia — referencia la Ley 1581 de protección de datos; nota: debe revisarla un abogado).
4. Prueba de humo final en producción con el checklist: registro nuevo → onboarding → clienta → cita → WhatsApp → link público → calendar → cobro → finanzas → inventario → instalación PWA en iOS y Android.
5. Genera docs/LANZAMIENTO.md con el resultado del checklist, fecha, y los pendientes aceptados.
```

**Validación final del proyecto:** una manicurista que no participó en el desarrollo completa el flujo entero sin ayuda. Sus confusiones = el backlog post-lanzamiento.

---

# Apéndice A — Qué hacer cuando algo sale mal

- **Un bloque quedó a medias en un chat:** abre chat nuevo, pega el contexto inicial (1.1) y añade: "El bloque X quedó incompleto. Lee docs/ESTADO.md y el código actual, dime qué falta contra el plan, y termina solo lo que falta."
- **El gate falla repetidamente:** no acumules arreglos encima de arreglos. Pide: "Detente. Lista las causas raíz de los fallos, propón el arreglo mínimo para cada una y espera mi ok."
- **Cowork propone cambiar una decisión de docs/DECISIONES.md:** la respuesta por defecto es no. Si la razón es fuerte, se actualiza DECISIONES.md primero (con fecha y motivo) y luego se implementa.
- **Una migración salió mal en producción:** nunca editar una migración ya aplicada; siempre una migración nueva que corrija. El runbook (F10.B2) cubre el restore.
- **Deriva del plan:** si el código real ya no coincide con este documento, actualiza el documento. El plan es vivo; la mentira en la documentación es peor que el cambio.

# Apéndice B — Orden recomendado y paralelismo

Camino crítico: F0 → F1 → F2 → F3 → F4 → F8. Tras F3 puedes intercalar F5, F6 y F7 en cualquier orden (son independientes entre sí). F9 y F10 al final siempre. Si quieres valor visible lo antes posible: F0–F4 te dan una app que ya resuelve el día a día de una manicurista; F5–F8 son los multiplicadores.

# Apéndice C — Variables de entorno (consolidado)

```text
DATABASE_URL                 # Railway la inyecta
BETTER_AUTH_SECRET           # openssl rand -base64 32
BETTER_AUTH_URL              # https://<dominio>
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   # F1 (login) y F5 (calendar)
GOOGLE_TOKEN_KEY             # F5, clave AES para cifrar refresh tokens
CRON_SECRET                  # F8
WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN / WA_VERIFY_TOKEN / WA_APP_SECRET   # F8
SENTRY_DSN                   # F10
```



