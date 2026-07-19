import type { Metadata } from "next";

import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = { title: "Desbloquear" };

export default async function DesbloquearPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target =
    typeof next === "string" && next.startsWith("/") ? next : "/citas";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="bg-brand/10 text-brand flex size-14 items-center justify-center rounded-2xl text-2xl">
        🔒
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sección protegida</h1>
        <p className="text-muted-foreground text-sm">
          Confirma que eres tú para ver esta sección.
        </p>
      </div>
      <UnlockForm next={target} />
    </div>
  );
}
