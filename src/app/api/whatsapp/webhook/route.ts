import { constantTimeEqual } from "@/lib/timing-safe";
import { swallow } from "@/lib/swallow";
import { updateStatusByWaId } from "@/modules/whatsapp/messages";
import type { WaMessageStatus } from "@/modules/whatsapp/schema";
import { verifyWebhookSignature } from "@/modules/whatsapp/signature";

export const dynamic = "force-dynamic";

/** Verificación del webhook (Meta hace un GET con hub.challenge). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WA_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    verifyToken &&
    constantTimeEqual(token, verifyToken) &&
    challenge
  ) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        statuses?: {
          id: string;
          status: string;
          errors?: { title?: string }[];
        }[];
      };
    }[];
  }[];
};

const STATUS_MAP: Record<string, WaMessageStatus> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

/** Estados entrantes de Meta. Valida la firma y responde 200 rápido siempre. */
export async function POST(request: Request) {
  const appSecret = process.env.WA_APP_SECRET;
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!appSecret || !verifyWebhookSignature(raw, signature, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const body = JSON.parse(raw) as WebhookBody;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          const mapped = STATUS_MAP[st.status];
          if (mapped) {
            await updateStatusByWaId(
              st.id,
              mapped,
              mapped === "failed" ? (st.errors?.[0]?.title ?? "failed") : null,
            );
          }
        }
      }
    }
  } catch (err) {
    // Cuerpo inesperado: igual respondemos 200 para que Meta no reintente, pero
    // dejamos rastro (antes se perdía en silencio — QA).
    swallow(err, { module: "whatsapp", op: "webhook.parseBody" });
  }

  return new Response("OK", { status: 200 });
}
