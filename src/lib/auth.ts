import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { Resend } from "resend";

import { db } from "@/lib/db";
import * as authSchema from "@/modules/tenancy/auth-schema";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const fromEmail =
  process.env.RESEND_FROM_EMAIL ?? "CatApp <no-reply@catapp.co>";

// reCAPTCHA v3 (item 9): protege registro y recuperación de contraseña. Se
// activa solo si hay secret key (patrón "encender con credenciales"); sin ella,
// el auth funciona sin captcha (dev). El cliente manda el token en el header
// `x-captcha-response` (ver src/lib/recaptcha-client.ts).
const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

/**
 * Email verification + account-linking estricto (B3.2, RG-5/H-04). Se activa
 * cuando Resend está configurado: en producción (con `RESEND_API_KEY`) queda
 * FORZADO — nadie inicia sesión ni vincula Google sin un email verificado, lo que
 * cierra la apropiación de cuenta. Si Resend no está (dev sin credenciales) se
 * desactiva para no bloquear el dev loop ni dejar a las usuarias sin poder
 * verificar. Revierte D-03 (email verification pasa de deuda a activa).
 */
const emailVerificationEnabled = Boolean(resend);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // En dev se accede desde localhost Y desde la IP de red (para pruebas en móvil).
  // Ambos orígenes deben ser confiados; de lo contrario Better Auth devuelve 403.
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
      : []),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Verificación de email (B3.2): forzada cuando Resend está configurado.
    requireEmailVerification: emailVerificationEnabled,
    async sendResetPassword({ user, url }) {
      if (!resend) {
        console.warn("[auth] RESEND_API_KEY no configurada — reset URL:", url);
        return;
      }
      await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Restablece tu contraseña — CatApp",
        html: `
          <p>Hola,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en CatApp.</p>
          <p>
            <a href="${url}" style="background:#06b6d4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Restablecer contraseña
            </a>
          </p>
          <p>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
        `,
      });
    },
  },
  // Verificación de email (B3.2, RG-5). SOLO se configura cuando Resend está
  // disponible: `sendOnSignUp` es independiente de `requireEmailVerification`, y
  // dejarlo activo sin Resend haría que Better Auth cree un token de verificación
  // en cada registro (rompe el alta sin poder enviar el correo). Al verificar, la
  // usuaria queda con sesión iniciada.
  ...(emailVerificationEnabled && resend
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          async sendVerificationEmail({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) {
            await resend.emails.send({
              from: fromEmail,
              to: user.email,
              subject: "Confirma tu correo — CatApp",
              html: `
                <p>¡Hola!</p>
                <p>Confirma tu correo para empezar a usar CatApp.</p>
                <p>
                  <a href="${url}" style="background:#06b6d4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                    Confirmar mi correo
                  </a>
                </p>
                <p>Si no creaste esta cuenta, ignora este mensaje.</p>
              `,
            });
          },
        },
      }
    : {}),
  // Google OAuth solo si hay credenciales (mismo proyecto se reutiliza en F5 para Calendar).
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  // Permite vincular la cuenta de Google con un usuario existente (email/password).
  // Sin esto, Better Auth lanza account_not_linked si el email ya existe.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Linking estricto (B3.2, H-04): solo se vincula Google si el email local
      // ya está verificado. Evita que alguien reclame una cuenta ajena con un
      // email no verificado. Atado a la misma condición que la verificación:
      // permisivo solo cuando no podemos verificar (dev sin Resend).
      requireLocalEmailVerified: emailVerificationEnabled,
    },
  },
  plugins: [
    // Captcha en registro y recuperación (NO en login: su form no envía token).
    // El plugin verifica el token del header con Google y rechaza si falla/score bajo.
    ...(recaptchaSecret
      ? [
          captcha({
            provider: "google-recaptcha",
            secretKey: recaptchaSecret,
            minScore: 0.5,
            endpoints: [
              "/sign-up/email",
              "/request-password-reset",
              "/forget-password",
            ],
          }),
        ]
      : []),
    // nextCookies debe ir al final (Better Auth).
    nextCookies(),
  ],
});
