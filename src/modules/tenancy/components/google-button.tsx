"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleButton({ label }: { label: string }) {
  async function handleClick() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/citas",
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
