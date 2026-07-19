import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTenant } from "@/modules/tenancy/context";
import { savePushSubscription } from "@/modules/birthdays/repository";

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
