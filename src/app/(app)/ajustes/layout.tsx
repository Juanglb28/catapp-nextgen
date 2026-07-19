import { type ReactNode } from "react";

import { requireUnlocked } from "@/modules/security/guard";

export default async function AjustesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUnlocked("/ajustes");
  return children;
}
