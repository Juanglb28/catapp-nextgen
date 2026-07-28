# reCAPTCHA v3 — operación y ajuste

Protección anti-bot en **registro** (`/sign-up/email`) y **recuperación de
contraseña** (`/request-password-reset`). Invisible (v3): no hay casilla ni
desafío, Google calcula un **score de 0.0 (bot) a 1.0 (humano)** y el servidor
decide. Decisión D-20. NO protege el login (su formulario no envía token).

## Cómo está montado (resumen)

- **Cliente** (`src/lib/recaptcha-client.ts`): genera un token por acción con
  `grecaptcha.execute(siteKey, { action })` y lo manda en el header
  `x-captcha-response`. Se activa solo si existe `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
- **Servidor** (`src/lib/auth.ts`): plugin `captcha` de Better Auth
  (`provider: "google-recaptcha"`). Verifica el token con Google usando
  `RECAPTCHA_SECRET_KEY` y exige `success` + `score ≥ minScore` + dominio válido.
  Se activa solo si existe `RECAPTCHA_SECRET_KEY`.
- **CSP** (`next.config.ts`): `script-src`/`frame-src`/`connect-src` permiten
  `https://www.google.com` + `https://www.gstatic.com`, y `script-src` incluye
  `'unsafe-eval'` (reCAPTCHA lo usa para su scoring).

## Variables de entorno

| Variable                         | Dónde    | Notas                                                                                                                     |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | cliente  | **Pública.** Se incrusta en el build (ARG en el Dockerfile). Al cambiarla en Railway hay que **redesplegar/reconstruir**. |
| `RECAPTCHA_SECRET_KEY`           | servidor | **Secreta.** Solo runtime; nunca `NEXT_PUBLIC_`, nunca al repo.                                                           |

Sin ambas, el auth funciona sin captcha (útil en dev).

## Ajustar el `minScore` (lo que normalmente vas a tocar)

El umbral vive en **`src/lib/auth.ts`**, en el plugin `captcha`:

```ts
captcha({
  provider: "google-recaptcha",
  secretKey: recaptchaSecret,
  minScore: 0.5, // <-- ajústalo aquí
  endpoints: ["/sign-up/email", "/request-password-reset", "/forget-password"],
}),
```

Guía de valores (score = qué tan "humano" parece; se rechaza por **debajo** del
umbral):

| minScore | Efecto                                        | Cuándo usarlo                                                |
| -------- | --------------------------------------------- | ------------------------------------------------------------ |
| `0.3`    | Permisivo: deja pasar casi todo.              | Si ves **falsos positivos** (usuarias legítimas bloqueadas). |
| `0.5`    | **Equilibrado (valor actual).**               | Punto de partida recomendado por Google.                     |
| `0.7`    | Estricto: bloquea más bots, arriesga humanos. | Si te llega **spam de registros** pese al captcha.           |
| `0.9`    | Muy estricto.                                 | Solo bajo ataque fuerte; alto riesgo de bloquear gente real. |

Recomendación: no lo muevas a ciegas. Primero mira los **scores reales** (abajo),
y ajusta de a `0.1`. Cambiar el valor requiere **commit + deploy** (el servidor
lo lee al arrancar).

## Ver los scores reales (para decidir el umbral)

En la consola de reCAPTCHA (`https://www.google.com/recaptcha/admin`), abre tu
sitio → verás analíticas por **acción** (`register`, `reset`) con la distribución
de scores. Si la mayoría de tus registros legítimos caen, por ejemplo, en 0.7–0.9,
un `minScore` de 0.5 va sobrado; si aparece mucho tráfico en 0.1–0.3, es bot.

También puedes loguear el score en el servidor temporalmente para depurar, pero
con las analíticas de Google suele bastar.

## Troubleshooting (síntomas que ya vimos)

- **`{"code":"MISSING_RESPONSE"}` (400) al registrar:** el cliente no envió token.
  Casi siempre `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` **no quedó en el build**. En
  Network no aparece la petición a `recaptcha/api.js`. Solución: verifica que la
  variable exista en Railway y **fuerza un rebuild** (un "Redeploy" a veces solo
  reinicia la imagen; empuja un commit para reconstruir de verdad).
- **La consola dice "script-src blocks ... google.com":** falta abrir el CSP en
  `next.config.ts` (ver arriba).
- **La consola dice "blocks the use of 'eval'":** falta `'unsafe-eval'` en
  `script-src` (reCAPTCHA lo necesita).
- **No aparece el badge al abrir la página:** es normal — el script se carga al
  **enviar** el formulario (carga diferida), no al abrir. El badge sale tras el
  primer submit. (Si se quisiera badge siempre visible, se precargaría al montar.)
- **Usuarias legítimas bloqueadas:** baja el `minScore` (ver tabla).

## Producción (cutover)

Crea (o reutiliza) el sitio reCAPTCHA con el dominio de producción
(`catapp.beauty`) entre los dominios permitidos, y pon las dos variables en el
servicio de producción de Railway. Recuerda **redesplegar** para hornear la site
key. Ver `docs/CUTOVER-CHECKLIST.md`.
