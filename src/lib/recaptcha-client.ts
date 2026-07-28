/**
 * Cliente de Google reCAPTCHA v3 (invisible). Genera un token por acción que se
 * envía en el header `x-captcha-response`; Better Auth (plugin captcha) lo
 * verifica en el servidor con la secret key.
 *
 * Se activa solo si `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` está configurada; si no,
 * `getRecaptchaToken` devuelve null y el flujo de auth sigue sin captcha (igual
 * patrón que Resend/VAPID: la protección se enciende cuando hay credenciales).
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

interface Grecaptcha {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

/** ¿Está configurado reCAPTCHA en el cliente? */
export function recaptchaEnabled(): boolean {
  return Boolean(SITE_KEY);
}

let loadPromise: Promise<void> | null = null;

/** Carga el script de reCAPTCHA una sola vez. */
function loadScript(): Promise<void> {
  if (!SITE_KEY || typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar reCAPTCHA."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Genera un token de reCAPTCHA v3 para la acción dada. Devuelve null si no está
 * configurado o si falla (para no bloquear al usuario si Google no responde:
 * la verificación server-side es la que realmente decide).
 */
export async function getRecaptchaToken(
  action: string,
): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined") return null;
  try {
    await loadScript();
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) return null;
    return await new Promise<string | null>((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(SITE_KEY, { action })
          .then((token) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  } catch {
    return null;
  }
}
