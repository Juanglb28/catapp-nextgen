/**
 * Cliente de WhatsApp Cloud API (Graph API) — F8.B1. Feature flag: si faltan las
 * variables de entorno, el módulo queda inerte y la app funciona como en F4.
 * Los errores de Meta se mapean a tipos seguros; NO se exponen detalles crudos
 * a la UI (se guardan en `wa_messages.error` para depurar).
 */

const GRAPH_VERSION = "v21.0";

type WaConfig = { phoneNumberId: string; accessToken: string };

export function whatsappConfig(): WaConfig | null {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

/** True si WhatsApp Cloud API está configurado (feature flag). */
export function isWhatsAppEnabled(): boolean {
  return whatsappConfig() !== null;
}

export type WhatsAppErrorKind =
  | "not_configured"
  | "invalid_number"
  | "template_not_approved"
  | "rate_limit"
  | "unknown";

export class WhatsAppError extends Error {
  readonly kind: WhatsAppErrorKind;
  constructor(kind: WhatsAppErrorKind, message: string) {
    super(message);
    this.name = "WhatsAppError";
    this.kind = kind;
  }
}

/** Mapea el código de error de Meta a un tipo seguro. */
export function mapMetaErrorCode(code: number | undefined): WhatsAppErrorKind {
  if (code === undefined) return "unknown";
  if ([131026, 131052, 131000, 131021].includes(code)) return "invalid_number";
  if (code >= 132000 && code < 133000) return "template_not_approved";
  if ([4, 80007, 130429, 131048, 131056].includes(code)) return "rate_limit";
  return "unknown";
}

/**
 * Envía una plantilla aprobada por Meta a un número E.164. Devuelve el
 * `wa_message_id` de Meta. Lanza `WhatsAppError` tipado si falla.
 */
export async function sendTemplate(
  toE164: string,
  templateName: string,
  variables: string[] = [],
  language = "es",
): Promise<string> {
  const cfg = whatsappConfig();
  if (!cfg) {
    throw new WhatsAppError("not_configured", "WhatsApp no está configurado.");
  }

  const to = toE164.replace(/\D/g, "");
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(variables.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: variables.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { code?: number; message?: string };
  };

  if (!res.ok) {
    const code = data.error?.code;
    throw new WhatsAppError(
      mapMetaErrorCode(code),
      `Meta error ${code ?? res.status}: ${data.error?.message ?? "sin detalle"}`,
    );
  }

  const id = data.messages?.[0]?.id;
  if (!id) {
    throw new WhatsAppError("unknown", "Respuesta de Meta sin message id.");
  }
  return id;
}
