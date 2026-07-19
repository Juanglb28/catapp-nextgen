/**
 * Teléfonos de Colombia. Los celulares CO son 10 dígitos que empiezan por 3.
 * Guardamos siempre en formato E.164 (+57XXXXXXXXXX).
 */

/**
 * Normaliza un celular colombiano a E.164 (+57 + 10 dígitos).
 * Acepta espacios, guiones, paréntesis, prefijo +57/57. Devuelve null si no es válido.
 */
export function normalizePhoneCO(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("57") && local.length === 12) {
    local = local.slice(2);
  }
  if (local.length === 10 && local.startsWith("3")) {
    return `+57${local}`;
  }
  return null;
}

/** Formato legible "+57 300 123 4567" a partir de un E.164 colombiano. */
export function formatPhoneCO(e164: string): string {
  const m = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Enlace `tel:` para llamar (usa el E.164 tal cual). */
export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** Enlace wa.me para abrir WhatsApp (solo dígitos, como exige wa.me). */
export function whatsappLink(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}
