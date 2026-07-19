"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Avisa cuando hay un service worker nuevo en espera y ofrece actualizar
 * (F9.B1). Al aceptar, le manda SKIP_WAITING y recarga al tomar el control.
 */
export function SwUpdater() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    function promptUpdate(waiting: ServiceWorker) {
      toast("Hay una nueva versión", {
        description: "Actualiza para tener las últimas mejoras.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: () => waiting.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    }

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      if (reg.waiting) promptUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            promptUpdate(installing);
          }
        });
      });
    });

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }, []);

  return null;
}
