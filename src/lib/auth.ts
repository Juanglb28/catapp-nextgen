import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";

import { db } from "@/lib/db";
import * as authSchema from "@/modules/tenancy/auth-schema";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

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
    // Email verification desactivada por ahora (deuda técnica, ver docs/DECISIONES.md).
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      if (!resend) {
        console.warn("[auth] RESEND_API_KEY no configurada — reset URL:", url);
        return;
      }
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "CatApp <no-reply@catapp.co>",
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
      // La app no verifica emails (deuda técnica D3), así que los usuarios
      // existentes tienen emailVerified=false. Sin esto, Better Auth bloquea
      // el linking y lanza account_not_linked.
      requireLocalEmailVerified: false,
    },
  },
  plugins: [nextCookies()],
});
