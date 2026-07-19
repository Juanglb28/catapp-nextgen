/** Detección de plataforma para la experiencia de instalación PWA (F9.B1). */

export type Platform = "ios" | "android" | "other";

/** Deduce la plataforma a partir del user-agent (puro, testeable). */
export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}
