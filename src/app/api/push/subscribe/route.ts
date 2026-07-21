import { NextResponse } from "next/server";
import { z } from "zod";

import { savePushSubscription } from "@/modules/push/repository";
import { consumeRateLimit } from "@/modules/rate-limit/repository";
import { requireTenant } from "@/modules/tenancy/context";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** Almacena o actualiza una suscripción Web Push del tenant autenticado. */
export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant();

    // Cobertura de rate-limit (B3.3): 30/min por tenant, generoso para el
    // re-envío idempotente de la suscripción pero corta abusos.
    const { allowed, retryAfterSec } = await consumeRateLimit(
      `push:${tenantId}`,
      { limit: 30, windowMs: 60_000 },
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }

    const body = await request.json();
    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Suscripción inválida" },
        { status: 400 },
      );
    }
    await savePushSubscription(tenantId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
