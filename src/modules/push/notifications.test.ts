import { beforeEach, describe, expect, it, vi } from "vitest";

type Payload = { title: string; body: string; url?: string };

// Mock del envío VAPID genérico: capturamos el payload construido por cada
// notificación sin tocar la red ni la DB. `vi.hoisted` evita el TDZ porque
// `vi.mock` se eleva por encima de los imports.
const { sendPushToTenant } = vi.hoisted(() => ({
  sendPushToTenant:
    vi.fn<(tenantId: string, payload: Payload) => Promise<boolean>>(
      async () => true,
    ),
}));

// `sendClientDecisionPush`/`sendBirthdayPushToTenant` importan `sendPushToTenant`
// desde el módulo push (B4/R-C3), así que el mock apunta ahí.
vi.mock("@/modules/push/send", () => ({
  sendPushToTenant,
}));

import { sendClientDecisionPush } from "@/modules/appointments/push";
import { sendBirthdayPushToTenant } from "@/modules/birthdays/push";

beforeEach(() => {
  sendPushToTenant.mockClear();
});

describe("sendClientDecisionPush", () => {
  it("confirmación: usa el primer nombre y enlaza al detalle de la cita", async () => {
    await sendClientDecisionPush("t1", "appt1", "Ana María Pérez", "accepted");
    expect(sendPushToTenant).toHaveBeenCalledWith("t1", {
      title: "✅ Ana confirmó su cita",
      body: "Toca para ver los detalles.",
      url: "/citas/appt1",
    });
  });

  it("rechazo con nota: la incluye como motivo (recortada)", async () => {
    await sendClientDecisionPush("t1", "appt1", "Sofía", "rejected", "  se enfermó  ");
    expect(sendPushToTenant).toHaveBeenCalledWith("t1", {
      title: "❌ Sofía no podrá asistir",
      body: "Motivo: se enfermó",
      url: "/citas/appt1",
    });
  });

  it("rechazo sin nota: usa el texto por defecto", async () => {
    await sendClientDecisionPush("t1", "appt1", "Luisa", "rejected", null);
    expect(sendPushToTenant).toHaveBeenCalledWith("t1", {
      title: "❌ Luisa no podrá asistir",
      body: "Toca para reagendar o cancelar.",
      url: "/citas/appt1",
    });
  });

  it("rechazo con nota en blanco: cae al texto por defecto", async () => {
    await sendClientDecisionPush("t1", "appt1", "Luisa", "rejected", "   ");
    expect(sendPushToTenant.mock.calls[0][1].body).toBe(
      "Toca para reagendar o cancelar.",
    );
  });

  it("nombre vacío/espacios: no rompe el título", async () => {
    await sendClientDecisionPush("t1", "appt1", "   ", "accepted");
    expect(sendPushToTenant.mock.calls[0][1].title).toContain(
      "confirmó su cita",
    );
  });
});

describe("sendBirthdayPushToTenant", () => {
  it("construye el aviso de cumpleaños con enlace a /cumpleanos", async () => {
    await sendBirthdayPushToTenant("t1", "Valentina");
    expect(sendPushToTenant).toHaveBeenCalledWith("t1", {
      title: "🎂 ¡Cumpleaños de Valentina!",
      body: "Revisa el bono de cumpleaños y decide si enviarlo.",
      url: "/cumpleanos",
    });
  });
});
