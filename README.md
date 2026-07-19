# CatApp

PWA SaaS mobile-first para manicuristas. Stack: Next.js 15 (App Router), TypeScript
strict, Tailwind CSS v4, shadcn/ui, Drizzle ORM + PostgreSQL (desde F0.B4), Serwist
(PWA, desde F0.B2). Gestor de paquetes: **pnpm**. Deploy: Railway.

Plan de desarrollo: `PLAN-APP-MANICURISTAS.md`. Decisiones cerradas: `docs/DECISIONES.md`.
Estado y progreso por bloque: `docs/ESTADO.md`.

## Requisitos

- Node.js 22+
- pnpm 9+ (`corepack enable` si no lo tienes)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env   # rellena los valores
pnpm dev               # http://localhost:3000
```

> En la primera instalación, pnpm pide aprobar los scripts de build de algunas
> dependencias nativas (esbuild, sharp, unrs-resolver). Ya están aprobadas en
> `pnpm-workspace.yaml`, así que `pnpm install` termina sin intervención.

## Scripts

| Script              | Qué hace                     |
| ------------------- | ---------------------------- |
| `pnpm dev`          | Servidor de desarrollo       |
| `pnpm build`        | Build de producción          |
| `pnpm start`        | Sirve el build de producción |
| `pnpm lint`         | ESLint                       |
| `pnpm typecheck`    | `tsc --noEmit`               |
| `pnpm test`         | Vitest (una pasada)          |
| `pnpm test:watch`   | Vitest en modo watch         |
| `pnpm format`       | Prettier (escribe)           |
| `pnpm format:check` | Prettier (solo verifica)     |

## Base de datos (desarrollo local)

La app usa PostgreSQL + Drizzle ORM. Dos opciones para tener una DB en local:

### Opción A — Docker (recomendada)

```bash
docker compose up -d            # levanta postgres:17 en localhost:5432
cp .env.example .env            # DATABASE_URL ya apunta al contenedor
pnpm db:generate                # genera la migración SQL (carpeta drizzle/)
pnpm db:migrate                 # crea las tablas
```

### Opción B — Base de datos de Railway

Crea un plugin Postgres en Railway y copia su `DATABASE_URL` (Connection URL) en tu `.env`. Luego `pnpm db:migrate`.

> En Windows, usa `127.0.0.1` (no `localhost`) en `DATABASE_URL`: `localhost` resuelve a IPv6 y Docker publica el puerto en IPv4.

### Verificar

Con la DB arriba y `pnpm dev` corriendo, visita <http://localhost:3000/api/health>: debe responder `{ "ok": true, "db": true }`. Si la DB está caída responde `503 { "ok": false, "db": false }`.

Las migraciones viven en `drizzle/` y se versionan en git. Nunca edites una migración ya aplicada: crea una nueva.

## Quality Gate (cierre de cada bloque)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Pre-commit (husky + lint-staged): corre `eslint --fix` y `prettier` sobre los
archivos en stage automáticamente.
