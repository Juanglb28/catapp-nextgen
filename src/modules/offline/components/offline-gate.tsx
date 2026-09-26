"use client";

import { Clock, RefreshCw, WifiOff } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";

import { heartbeat, warmIfDue } from "../client";
import {
  OFFLINE_HEARTBEAT_INTERVAL_MS,
  OFFLINE_PENDING_ATTR,
} from "../constants";
import type { PasswordVerifier } from "../password-verifier";
import {
  evaluateOfflineWindow,
  needsLocalUnlock,
  observeClock,
} from "../policy";
import {
  getItem,
  getSession,
  purgeOfflinePages,
  setItem,
  setSession,
} from "../store";
import { OfflineUnlock } from "./offline-unlock";

type Phase =
  | { kind: "checking" }
  | { kind: "online" }
  | { kind: "offline"; remainingMs: number }
  | {
      kind: "locked";
      rpId: string | null;
      credentialIds: string[];
      verifier: PasswordVerifier | null;
    }
  | { kind: "blocked"; reason: "expired" | "tampered" | "no-data" };

const ACTIVITY_THROTTLE_MS = 30_000;

function reveal() {
  document.documentElement.removeAttribute(OFFLINE_PENDING_ATTR);
}

/**
 * Control de acceso del modo offline de solo consulta (D-35).
 * - Con conexión: confirma la sesión con el servidor (reinicia la ventana de
 *   24 h), descarga por adelantado y deja pasar; Better Auth manda.
 * - Sin conexión: exige ventana vigente (≤ 24 h desde la última confirmación),
 *   reloj no manipulado y desbloqueo local con huella/contraseña al abrir la
 *   app o tras 15 min sin uso. Si la ventana venció o el reloj retrocedió,
 *   borra las páginas guardadas y pide reconectar.
 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [retrying, setRetrying] = useState(false);
  const lastActivityWrite = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const evaluateOffline = useCallback(async () => {
    const now = Date.now();
    const state = await getItem("state");
    const verdict = evaluateOfflineWindow(state, now);

    if (verdict.kind === "expired" || verdict.kind === "tampered") {
      setSession(null);
      await purgeOfflinePages();
      setPhase({ kind: "blocked", reason: verdict.kind });
      return;
    }
    if (verdict.kind === "no-data" || !state) {
      setPhase({ kind: "blocked", reason: "no-data" });
      return;
    }
    await setItem("state", observeClock(state, now));

    if (needsLocalUnlock(getSession(), now)) {
      setSession(null);
      const [creds, verifier] = await Promise.all([
        getItem("credentials"),
        getItem("verifier"),
      ]);
      setPhase({
        kind: "locked",
        rpId: creds?.rpId ?? null,
        credentialIds: creds?.ids ?? [],
        verifier:
          verifier && verifier.userId === state.userId ? verifier : null,
      });
      return;
    }
    setPhase({ kind: "offline", remainingMs: verdict.remainingMs });
  }, []);

  const evaluate = useCallback(async () => {
    if (navigator.onLine) {
      const result = await heartbeat();
      if (result === "online") {
        setPhase({ kind: "online" });
        void warmIfDue();
        return;
      }
      if (result === "signed-out") {
        // El servidor redirigirá a /login en la próxima navegación.
        setPhase({ kind: "online" });
        return;
      }
      // "network-error": señal falsa (lie-fi) → se trata como sin conexión.
    }
    await evaluateOffline();
  }, [evaluateOffline]);

  // Primera evaluación + eventos de red/visibilidad + relojes periódicos.
  useEffect(() => {
    void evaluate();

    const onOnline = () => void evaluate();
    const onOffline = () => void evaluateOffline();
    const onVisible = () => {
      if (document.visibilityState === "visible") void evaluate();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    // Sin conexión: cada minuto se registra el reloj (detección de
    // manipulación) y se re-evalúan inactividad y vencimiento.
    const tick = window.setInterval(() => {
      if (phaseRef.current.kind === "offline") void evaluateOffline();
    }, 60_000);
    // Con conexión: latido periódico para mantener fresca la ventana.
    const beat = window.setInterval(() => {
      if (
        phaseRef.current.kind === "online" &&
        document.visibilityState === "visible"
      ) {
        void evaluate();
      }
    }, OFFLINE_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(tick);
      window.clearInterval(beat);
    };
  }, [evaluate, evaluateOffline]);

  // Actividad de la usuaria → reinicia el conteo de 15 min de inactividad.
  useEffect(() => {
    const onActivity = () => {
      const kind = phaseRef.current.kind;
      if (kind !== "online" && kind !== "offline") return;
      const now = Date.now();
      if (now - lastActivityWrite.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityWrite.current = now;
      const session = getSession();
      if (session) setSession({ ...session, lastActivityAt: now });
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const e of events) {
      window.addEventListener(e, onActivity, { passive: true });
    }
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, []);

  useEffect(() => {
    if (phase.kind !== "checking") reveal();
  }, [phase.kind]);

  async function retry() {
    setRetrying(true);
    try {
      await evaluate();
    } finally {
      setRetrying(false);
    }
  }

  if (phase.kind === "locked") {
    return (
      <main className="flex-1 px-4 pt-5 pb-24">
        <OfflineUnlock
          rpId={phase.rpId}
          credentialIds={phase.credentialIds}
          verifier={phase.verifier}
          onUnlocked={() => {
            const now = Date.now();
            setSession({ unlockedAt: now, lastActivityAt: now });
            void evaluateOffline();
          }}
        />
      </main>
    );
  }

  if (phase.kind === "blocked") {
    return (
      <main className="flex-1 px-4 pt-5 pb-24">
        <BlockedScreen
          reason={phase.reason}
          retrying={retrying}
          onRetry={retry}
        />
      </main>
    );
  }

  return (
    <>
      {phase.kind === "offline" && (
        <OfflineBanner remainingMs={phase.remainingMs} />
      )}
      <div data-offline-content>{children}</div>
    </>
  );
}

const BLOCKED_COPY = {
  expired: {
    title: "Conéctate para seguir",
    body: "Pasaron más de 24 horas sin conexión. Por seguridad, los datos guardados se borraron del teléfono. Con internet se vuelven a descargar.",
  },
  tampered: {
    title: "Revisa la fecha y hora",
    body: "La fecha u hora del teléfono cambió hacia atrás. Por seguridad, conéctate a internet para verificar y volver a consultar tus datos.",
  },
  "no-data": {
    title: "Sin conexión",
    body: "Todavía no hay datos guardados en este teléfono para consultar sin internet. Abre la app con conexión al menos una vez.",
  },
} as const;

function BlockedScreen({
  reason,
  retrying,
  onRetry,
}: {
  reason: "expired" | "tampered" | "no-data";
  retrying: boolean;
  onRetry: () => void;
}) {
  const copy = BLOCKED_COPY[reason];
  const Icon = reason === "tampered" ? Clock : WifiOff;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.body}</p>
      </div>
      <Button onClick={onRetry} disabled={retrying} variant="outline">
        <RefreshCw
          className={retrying ? "size-4 animate-spin" : "size-4"}
          aria-hidden
        />
        {retrying ? "Verificando…" : "Reintentar"}
      </Button>
    </div>
  );
}
