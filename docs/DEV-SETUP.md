# Desarrollo local — CatApp-NextGen

Guía corta para levantar el proyecto en tu máquina. Stack: Next.js 15 (App
Router), pnpm, Postgres (Docker), Drizzle. Requiere **Node 22+**, **pnpm**
(`corepack enable`) y **Docker**.

## 1. Base de datos (Postgres en Docker)

La primera vez:

```bash
docker compose up -d      # crea el contenedor catapp-db (Postgres 17, puerto 5433)
```

En arranques siguientes, si el contenedor ya existe, **solo arráncalo** (no lo
recrees con compose, o adjuntaría un volumen nuevo vacío):

```bash
docker start catapp-db
docker ps                 # verifica que está "Up"
```

Para apagar/prender sin perder datos: `docker compose stop` / `docker start
catapp-db`. **Nunca** uses `docker compose down -v` ni `docker rm -v`: borran el
volumen y pierdes los datos de desarrollo (se regeneran con `pnpm db:migrate`,
pero pierdes lo que tuvieras).

## 2. Variables de entorno (`.env`)

Copia `.env.example` a `.env`. Mínimo obligatorio:

```bash
DATABASE_URL="postgresql://catapp:catapp@127.0.0.1:5433/catapp"
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:3000"
```

En Windows usa `127.0.0.1` (no `localhost`) en `DATABASE_URL`: `localhost`
resuelve a IPv6 y Docker publica el puerto en IPv4.

### Modo localhost (recomendado para dev)

Con `BETTER_AUTH_URL="http://localhost:3000"` y entrando siempre por
**http://localhost:3000**, los enlaces de verificación de correo y de reset de
contraseña salen con `localhost` y cargan sin problema. No necesitas
`BETTER_AUTH_TRUSTED_ORIGINS` (localhost y 127.0.0.1 son de confianza por
defecto) ni `allowedDevOrigins`.

### Probar en el celular (opcional)

Si quieres abrir la app desde el móvil por la IP de red (p. ej.
`http://192.168.1.18:3000`):

- Pon esa IP en `BETTER_AUTH_URL` y añádela a `BETTER_AUTH_TRUSTED_ORIGINS`
  (lista separada por comas, **sin espacios** tras la coma).
- Abre el correo en un dispositivo en la **misma WiFi**.
- La IP de DHCP puede cambiar entre sesiones; si el login falla con `Invalid
  origin` o un enlace no carga, actualiza ambas variables con la IP actual y
  reinicia `pnpm dev`.

### Integraciones opcionales

Sin estas variables, la función queda inerte pero la app arranca:

- **Resend** (correos de verificación y reset): sin `RESEND_API_KEY`, el enlace
  se imprime en el terminal de `pnpm dev` en vez de enviarse. Con la clave, en
  modo de prueba de Resend (sin dominio verificado) solo se envía **desde**
  `onboarding@resend.dev` (`RESEND_FROM_EMAIL="CatApp <onboarding@resend.dev>"`)
  y **hacia** la dirección con la que registraste tu cuenta de Resend. Nota:
  con `RESEND_API_KEY` configurada se **activa** la verificación de email en el
  registro.
  - **Síntoma: registras una cuenta nueva y el flujo se queda atascado porque
    el correo de verificación nunca llega** (aunque el log de `pnpm dev`
    muestre el POST a `sign-up/email` en `200` y el payload que se intentó
    enviar). Causa más común: `RESEND_FROM_EMAIL` sigue apuntando al
    remitente de sandbox (`onboarding@resend.dev`), que **solo entrega al
    dueño de la cuenta de Resend** — si registras con cualquier otro correo,
    Resend no lo entrega, aunque la llamada a la API "se vea bien" en el log
    de la app (ese log es lo que se *intentó* enviar, no una confirmación de
    entrega). Fix: si ya verificaste un dominio propio en Resend (pestaña
    **Domains**), pon en tu `.env` un remitente de ese dominio, p. ej.
    `RESEND_FROM_EMAIL="CatApp <no-reply@tudominio>"`, y **reinicia
    `pnpm dev`** (las env vars se leen solo al arrancar). Si el correo sigue
    sin llegar después de eso: (1) revisa la pestaña **Logs** del dashboard de
    Resend para ver si la llamada llegó y qué pasó (entregado/rebotado/error)
    — es la fuente de verdad, más confiable que el log de la app; (2) revisa
    con `pnpm db:studio` si ya existe un usuario sin verificar con ese mismo
    correo de un intento anterior, lo que puede cambiar el comportamiento del
    reenvío.
  - **Resuelto 2026-08-06 (D-22):** confirmado en vivo — el flujo de sign-up →
    correo → verificación funciona bien una vez `RESEND_FROM_EMAIL` apunta a un
    dominio verificado. El botón "Reenviar correo de confirmación" (que ya
    existía en `login-form.tsx`) ahora además queda protegido por el mismo
    rate-limit del resto de auth, y un cron nuevo (`cron-cleanup-unverified`)
    borra a diario las cuentas nunca verificadas más viejas de 48h, para que
    un correo abandonado en pruebas no quede "reservado" para siempre. Ver
    `docs/CRONS.md` y `docs/DECISIONES.md` (D-22).
- **Google OAuth**, **WhatsApp**, **VAPID/push**: ver `.env.example`.

## 3. Migraciones y arranque

```bash
pnpm install
pnpm db:migrate     # aplica las migraciones (idempotente)
pnpm dev            # http://localhost:3000
```

Comprueba la DB en <http://localhost:3000/api/health> → `{ "ok": true, "db":
true }`.

## 4. Comandos útiles

| Comando              | Qué hace                                  |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Servidor de desarrollo                    |
| `pnpm db:studio`     | Explorador visual de la base (tablas)     |
| `pnpm lint`          | ESLint (incluye `import/no-cycle`)        |
| `pnpm typecheck`     | `tsc --noEmit`                            |
| `pnpm test`          | Vitest (unit; integración se salta sin DB de test) |
| `pnpm test:unit`     | Solo tests unitarios (rápido)             |
| `pnpm test:integration` | Tests de integración (requiere `TEST_DATABASE_URL` a una DB desechable) |

## 5. Problemas comunes

- **`Conflict. The container name "/catapp-db" is already in use`** al hacer
  `docker compose up`: el contenedor ya existe; usa `docker start catapp-db`.
- **Login por email da 403 `Invalid origin`**: estás entrando por una IP de red
  no declarada. Usa `http://localhost:3000`, o añade la IP a
  `BETTER_AUTH_TRUSTED_ORIGINS`.
- **El enlace del correo (verificar/reset) no carga (`ERR_CONNECTION_TIMED_OUT`)**:
  apunta a una IP de red inalcanzable. En modo localhost, abre el enlace en tu
  PC cambiando el host por `localhost`.
- **No llega el correo de reset y el terminal dice `Reset Password: User not
  found`**: el email no coincide con ninguna cuenta (o la cuenta es solo de
  Google, sin contraseña que restablecer). Revisa la tabla `user` con
  `pnpm db:studio`.
- **Aviso `Cross origin request detected ... /_next/*`**: solo si entras por IP.
  Se silencia con `allowedDevOrigins` en `next.config`, o entrando por localhost.
- **Studio muestra las tablas vacías / los registros no aparecen** aunque te
  registraste: casi siempre es que `pnpm dev` y `pnpm db:studio` corren en
  terminales que apuntan a bases distintas. La variable
  `$env:DATABASE_URL="…catapp_test"` que exportas para `pnpm test:integration`
  **es pegajosa**: dura toda esa ventana de PowerShell y tiene prioridad sobre el
  `.env`. Si arrancas `pnpm dev` en esa misma ventana, la app escribe en
  `catapp_test` mientras Studio (en otra ventana) lee `catapp`. Regla: usa esa
  variable **solo** en la ventana de los tests de integración; corre `pnpm dev`
  y `pnpm db:studio` en terminales **sin** ella. Verifica en Studio → SQL console
  con `select current_database();`, y en la terminal con `echo $env:DATABASE_URL`.
