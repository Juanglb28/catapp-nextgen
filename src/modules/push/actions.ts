"use server";

import { isPushConfigured, sendPushToTenant } from "@/lib/push";
import { getTenantPushSubscriptions } from "@/modules/birthdays/repository";
import { requireTenant } from "@/modules/tenancy/context";

/**
 * Resultado del diagnóstico de push. Distingue las tres causas reales por las
 * que una notificación no llega, para no tener que adivinar:
 *  - not_configured: faltan las claves VAPID en el servidor.
 *  - no_subscriptions: ningún dispositivo de este negocio está suscrito.
 *  - send_failed: había suscripciones pero el envío no prosperó (expiradas).
 */
export type TestPushResult =
  | { ok: true; devices: number }
  | {
      ok: false;
      reason: "not_configured" | "no_subscriptions" | "send_failed";
    };

/** Envía una notificación de prueba a los dispositivos suscritos del negocio. */
export async function sendTestPushAction(): Promise<TestPushResult> {
  const { tenantId } = await requireTenant();

  if (!isPushConfigured()) return { ok: false, reason: "not_configured" };

  const subs = await getTenantPushSubscriptions(tenantId);
  if (subs.length === 0) return { ok: false, reason: "no_subscriptions" };

  const sent = await sendPushToTenant(tenantId, {
    title: "🔔 Notificación de prueba",
    body: "Si ves esto, las notificaciones funcionan correctamente.",
    url: "/ajustes",
  });

  return sent
    ? { ok: true, devices: subs.length }
    : { ok: false, reason: "send_failed" };
}
