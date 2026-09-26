"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearOfflineData } from "@/modules/offline/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    // D-35: nada de la cuenta queda consultable sin conexión tras salir.
    await clearOfflineData();
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={loading}>
      {loading ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
