# Imagen de producción de CatApp.
# Instala pnpm con npm (sin corepack) para evitar el bug
# ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING de corepack en el builder.
FROM node:22-bookworm-slim

ENV NODE_ENV=production
# pnpm fijado a la misma versión del proyecto (packageManager).
RUN npm install -g pnpm@11.5.3

WORKDIR /app

# 1) Dependencias (capa cacheable; se reinstala solo si cambian estos archivos).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# 2) Código y build de producción (genera .next y public/sw.js).
COPY . .

# Variables NEXT_PUBLIC_*: Next.js las INCRUSTA en el bundle del cliente durante
# `pnpm build`, así que deben existir en tiempo de build (no basta con tenerlas
# en runtime). Railway inyecta las variables del servicio como build args
# cuando se declaran con ARG. Sin esto, el bundle queda con `undefined` y el
# PushManager nunca suscribe el dispositivo (bug 2026-07-18: 0 suscripciones).
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# Better Auth exige un secret en build. Este es SOLO de build; en runtime Railway inyecta el real.
RUN BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime" pnpm build

EXPOSE 3000
# Railway inyecta PORT; `next start` lo respeta. db:migrate corre como preDeployCommand (railway.toml).
CMD ["pnpm", "start"]
