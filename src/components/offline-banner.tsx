"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/** Banner discreto cuando no hay conexión (F9.B1). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Sin conexión — mostrando datos guardados
    </div>
  );
}
