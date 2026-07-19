/**
 * Plantillas de mensajes de WhatsApp (F4.B2) — funciones PURAS, sin DB.
 * El texto base usa placeholders entre llaves que se sustituyen al renderizar.
 */

export const TEMPLATE_KEYS = [
  "confirmation",
  "reminder",
  "reschedule",
  "payment_reminder",
  "thankyou",
  "thankyou_bonus",
  "birthday",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  confirmation: "Confirmación",
  reminder: "Recordatorio",
  reschedule: "Reagendamiento",
  payment_reminder: "Recordatorio de pago",
  thankyou: "Agradecimiento",
  thankyou_bonus: "Agradecimiento con bono",
  birthday: "Cumpleaños",
};

/** Placeholders disponibles, para documentar en la UI de personalización. */
export const TEMPLATE_PLACEHOLDERS = [
  "{clienta}",
  "{negocio}",
  "{fecha}",
  "{hora}",
  "{servicios}",
  "{saldo}",
  "{link}",
  "{fecha_anterior}",
] as const;

/** Texto base por defecto de cada plantilla (editable por el tenant). */
export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  confirmation:
    "¡Hola {clienta}! 😊 Te confirmo tu cita en {negocio} el {fecha} a las {hora}.\n" +
    "Servicios: {servicios}.\n" +
    "Puedes ver los detalles aquí: {link}\n" +
    "¡Te espero! 💅",
  reminder:
    "¡Hola {clienta}! 💅 Te recuerdo tu cita en {negocio} el {fecha} a las {hora}.\n" +
    "Servicios: {servicios}.\n" +
    "Detalles: {link}\n" +
    "Si necesitas cambiarla, escríbeme. 😊",
  reschedule:
    "¡Hola {clienta}! Reagendamos tu cita en {negocio}.\n" +
    "Antes: {fecha_anterior}.\n" +
    "Ahora: {fecha} a las {hora}.\n" +
    "Servicios: {servicios}.\n" +
    "Detalles: {link}",
  payment_reminder:
    "¡Hola {clienta}! 😊 Te recuerdo que tienes un saldo pendiente de {saldo} " +
    "por tu cita en {negocio}.\n" +
    "Cuando puedas, quedo atenta para completar el pago. ¡Muchas gracias! 💕",
  thankyou:
    "Estás a paz y salvo, ¡gracias por preferir este servicio {clienta}! 💕\n" +
    "Espero que te haya encantado. Cuando quieras agendar de nuevo, aquí estoy.\n" +
    "— {negocio}",
  thankyou_bonus:
    "Estás a paz y salvo, ¡gracias por preferir este servicio {clienta}! 💕\n" +
    "Espero que te haya encantado tu regalo de cumpleaños. Cuando quieras agendar de nuevo, aquí estoy.\n" +
    "— {negocio}",
  birthday:
    "¡Feliz cumpleaños {clienta}! 🎉🎂\n" +
    "Espero que hoy pases un día muy especial rodeada de tus seres amados.\n" +
    "En este nuevo año {negocio} quiere hacerte un regalo para consentirte. " +
    "Elige tu servicio gratis aquí 👇\n" +
    "{link}\n" +
    "Redimible en el mes de tu cumpleaños. 💅",
};

export type TemplateVars = {
  clienta?: string;
  negocio?: string;
  fecha?: string;
  hora?: string;
  servicios?: string;
  saldo?: string;
  link?: string;
  fecha_anterior?: string;
};

/**
 * Sustituye los placeholders `{x}` por sus valores. Los placeholders sin valor
 * se eliminan (cadena vacía). Es pura y segura de usar en cliente o servidor.
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value ?? "";
  });
}

/**
 * Construye el enlace wa.me con el texto codificado. `phone` puede venir en
 * E.164 o con símbolos; se reduce a dígitos. El texto se codifica con
 * `encodeURIComponent`, que maneja tildes, emojis y saltos de línea.
 */
export function buildWaLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
