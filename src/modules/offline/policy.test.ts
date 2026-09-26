import { describe, expect, it } from "vitest";

import {
  CLOCK_TOLERANCE_MS,
  OFFLINE_IDLE_LOCK_MS,
  OFFLINE_WINDOW_MS,
  isOfflinePagePath,
} from "./constants";
import {
  type OfflineState,
  confirmOnline,
  evaluateOfflineWindow,
  needsLocalUnlock,
  observeClock,
  shouldWarm,
} from "./policy";

const T0 = Date.UTC(2026, 8, 25, 13, 0, 0);
const HOUR = 60 * 60 * 1000;

function state(overrides: Partial<OfflineState> = {}): OfflineState {
  return { userId: "u1", lastOnlineAt: T0, lastSeenAt: T0, ...overrides };
}

describe("evaluateOfflineWindow", () => {
  it("sin estado previo no hay datos offline", () => {
    expect(evaluateOfflineWindow(null, T0)).toEqual({ kind: "no-data" });
  });

  it("dentro de 24 h permite consultar e informa lo que queda", () => {
    const v = evaluateOfflineWindow(state(), T0 + 3 * HOUR);
    expect(v).toEqual({
      kind: "ok",
      remainingMs: OFFLINE_WINDOW_MS - 3 * HOUR,
    });
  });

  it("justo en 24 h sigue permitido; un ms después expira", () => {
    expect(evaluateOfflineWindow(state(), T0 + OFFLINE_WINDOW_MS).kind).toBe(
      "ok",
    );
    expect(
      evaluateOfflineWindow(state(), T0 + OFFLINE_WINDOW_MS + 1).kind,
    ).toBe("expired");
  });

  it("detecta el reloj atrasado respecto al máximo observado", () => {
    const s = state({ lastSeenAt: T0 + 20 * HOUR });
    // Atrasar el reloj a la hora 2 para "ganar" horas de ventana.
    expect(evaluateOfflineWindow(s, T0 + 2 * HOUR).kind).toBe("tampered");
  });

  it("tolera pequeños ajustes del reloj (NTP)", () => {
    const s = state({ lastSeenAt: T0 + HOUR });
    const v = evaluateOfflineWindow(s, T0 + HOUR - CLOCK_TOLERANCE_MS + 1);
    expect(v.kind).toBe("ok");
  });

  it("reloj anterior a la última conexión = manipulación", () => {
    expect(evaluateOfflineWindow(state(), T0 - 2 * HOUR).kind).toBe("tampered");
  });

  it("adelantar el reloj solo acorta la ventana", () => {
    expect(evaluateOfflineWindow(state(), T0 + 30 * HOUR).kind).toBe("expired");
  });
});

describe("needsLocalUnlock", () => {
  it("sin sesión desbloqueada (app recién abierta) pide desbloqueo", () => {
    expect(needsLocalUnlock(null, T0)).toBe(true);
  });

  it("actividad reciente no pide desbloqueo", () => {
    const s = { unlockedAt: T0, lastActivityAt: T0 };
    expect(needsLocalUnlock(s, T0 + OFFLINE_IDLE_LOCK_MS)).toBe(false);
  });

  it("más de 15 min inactiva vuelve a pedir desbloqueo", () => {
    const s = { unlockedAt: T0, lastActivityAt: T0 };
    expect(needsLocalUnlock(s, T0 + OFFLINE_IDLE_LOCK_MS + 1)).toBe(true);
  });

  it("reloj atrasado respecto a la última actividad pide desbloqueo", () => {
    const s = { unlockedAt: T0, lastActivityAt: T0 + HOUR };
    expect(needsLocalUnlock(s, T0)).toBe(true);
  });
});

describe("observeClock / confirmOnline / shouldWarm", () => {
  it("lastSeenAt nunca retrocede", () => {
    const s = state({ lastSeenAt: T0 + HOUR });
    expect(observeClock(s, T0).lastSeenAt).toBe(T0 + HOUR);
    expect(observeClock(s, T0 + 2 * HOUR).lastSeenAt).toBe(T0 + 2 * HOUR);
  });

  it("confirmar en línea reinicia la ventana y conserva lastWarmAt del mismo usuario", () => {
    const prev = state({ lastWarmAt: T0 });
    const next = confirmOnline(prev, "u1", T0 + 5 * HOUR);
    expect(next).toEqual({
      userId: "u1",
      lastOnlineAt: T0 + 5 * HOUR,
      lastSeenAt: T0 + 5 * HOUR,
      lastWarmAt: T0,
    });
  });

  it("otro usuario no hereda lastWarmAt", () => {
    const next = confirmOnline(state({ lastWarmAt: T0 }), "u2", T0);
    expect(next.lastWarmAt).toBeUndefined();
  });

  it("shouldWarm respeta el intervalo", () => {
    expect(shouldWarm(null, T0, HOUR)).toBe(true);
    expect(shouldWarm(state({ lastWarmAt: T0 }), T0 + HOUR - 1, HOUR)).toBe(
      false,
    );
    expect(shouldWarm(state({ lastWarmAt: T0 }), T0 + HOUR, HOUR)).toBe(true);
  });
});

describe("isOfflinePagePath", () => {
  const id = "3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b";
  it.each([
    ["/citas", true],
    ["/citas/", true],
    [`/citas/${id}`, true],
    ["/clientas", true],
    [`/clientas/${id}`, true],
    ["/citas/nueva", false],
    ["/clientas/importar", false],
    ["/clientas/duplicados", false],
    ["/finanzas", false],
    ["/ajustes", false],
    ["/cumpleanos", false],
    ["/inventario", false],
    [`/cita/${id}`, false],
    ["/api/offline/status", false],
  ])("%s -> %s", (path, expected) => {
    expect(isOfflinePagePath(path)).toBe(expected);
  });
});
