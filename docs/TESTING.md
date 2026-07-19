# Estrategia de tests — CatApp

> Última actualización: 2026-06-17 (F9.B3)

## Pirámide de tests

```
          ╔══════════╗
          ║   E2E    ║  10 specs · Playwright
          ╠══════════╣
          ║Integración║  17 archivos · Vitest + DB real
          ╠══════════╣
          ║   Unit   ║  22 archivos · Vitest (sin DB)
          ╚══════════╝
```

| Nivel       | Archivos | Herramienta        | Tiempo aprox. | Descripción                                                    |
| ----------- | :------: | ------------------ | :-----------: | -------------------------------------------------------------- |
| Unit        |    22    | Vitest             |     < 5 s     | Lógica pura (dominio, helpers, validaciones Zod, formateos).   |
| Integración |    17    | Vitest + Postgres  |    15–30 s    | Repositorios, Server Actions, aislamiento multi-tenant (A/B).  |
| E2E         |    10    | Playwright (móvil) |    2–5 min    | Flujos de usuario de extremo a extremo en build de producción. |

## Cómo correr cada nivel

### Unit + Integración (Vitest)

```bash
pnpm test                      # todos (unit + integración si TEST_DATABASE_URL)
pnpm test --run                # una sola pasada (sin watch)
pnpm test src/modules/finance  # filtrar por directorio
```

Los tests de integración se **saltan** si `TEST_DATABASE_URL` no está definida.
Para correrlos localmente:

```bash
# 1. Levantar Postgres (una sola vez)
docker compose up -d postgres

# 2. Añadir al .env
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/catapp_test

# 3. Correr
pnpm test
```

### E2E (Playwright)

Requiere la app corriendo en modo producción y un usuario de prueba en la DB.

```bash
# Con app en http://localhost:3000 (la levanta solo si E2E_BASE_URL no está)
pnpm test:e2e

# Con app ya corriendo en otra máquina/IP
$env:E2E_BASE_URL="http://192.168.1.18:3000"; pnpm test:e2e   # PowerShell
E2E_BASE_URL=http://192.168.1.18:3000 pnpm test:e2e           # bash/zsh

# Solo tests móviles (más rápido)
pnpm test:e2e --project=mobile

# Con UI de Playwright (modo headed interactivo)
pnpm exec playwright test --ui
```

Variables requeridas en `.env`:

```
E2E_TEST_EMAIL=...     # correo del usuario de prueba (no uses el de producción)
E2E_TEST_PASSWORD=...  # contraseña
```

### Lint + Typecheck

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
```

## Archivos E2E

| Archivo                  | Bloque | Qué cubre                                                  |
| ------------------------ | ------ | ---------------------------------------------------------- |
| `auth.setup.ts`          | F1.B1  | Login → guarda sesión en `e2e/.auth/session.json`          |
| `a11y.spec.ts`           | F9.B2  | axe-core sobre las 5 secciones principales (0 violaciones) |
| `agenda-nav.spec.ts`     | F3.B3  | Navegación entre días, vista semana, botón Hoy             |
| `crear-cita.spec.ts`     | F3.B2  | Flujo completo crear cita → redirige al detalle            |
| `ficha-clienta.spec.ts`  | F3.B5  | "Nueva cita" desde ficha preselecciona la clienta          |
| `compartir-cita.spec.ts` | F4.B1  | Link público no muestra precios ni teléfono                |
| `cita-en-curso.spec.ts`  | F3.B4  | Detalle, pago parcial, completar                           |
| `editar-cita.spec.ts`    | F3.B4  | Registrar pago, editar notas                               |
| `inventario.spec.ts`     | F7.B2  | Crear producto, entrada y salida de stock, historial       |
| `finanzas.spec.ts`       | F6.B2  | Dashboard, navegación de mes, export CSV (Content-Type)    |
| `offline.spec.ts`        | F9.B1  | `/offline` sin red, fallback en `/citas` sin red           |

## Proyectos Playwright

| Proyecto  | Viewport       | Cuándo corre                      |
| --------- | -------------- | --------------------------------- |
| `mobile`  | iPhone 14      | Siempre (principal, mobile-first) |
| `desktop` | Desktop Chrome | Local a petición / CI main        |

## CI (GitHub Actions)

El archivo `.github/workflows/ci.yml` tiene dos jobs:

**`quality`** (en todo push/PR): lint → typecheck → unit+integración (sin DB) → build.

**`e2e`** (solo en `main` o PRs con label `e2e`): corre después de `quality`, levanta Postgres 17 como servicio, aplica migraciones, crea usuario de prueba con `scripts/seed-e2e-user.ts`, hace `pnpm build` y ejecuta `pnpm test:e2e --project=mobile`. Las trazas de Playwright se suben como artefacto en caso de fallo (7 días de retención).

Secrets requeridos en el repo de GitHub: `BETTER_AUTH_SECRET`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.

## Política de cobertura por bloque futuro

Cada bloque de F10 en adelante debe llegar al merge con:

1. **Unit tests** para toda lógica pura nueva (funciones sin efectos secundarios).
2. **Tests de integración** para cada repositorio y Server Action nuevo, incluyendo un caso de **aislamiento A/B** (dos tenants distintos, sin cruce de datos).
3. **E2E** para el flujo happy-path del módulo si introduce una pantalla nueva.
4. **Sin regresiones**: `pnpm test` y `pnpm test:e2e --project=mobile` deben terminar en verde antes de abrir el PR.

Los tests de accesibilidad (`a11y.spec.ts`) cubren todas las rutas autenticadas; si se añade una ruta nueva, agregarla al array `ROUTES` en ese archivo.
