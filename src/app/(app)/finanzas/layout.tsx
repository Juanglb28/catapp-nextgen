import { type ReactNode } from "react";

import { requireUnlocked } from "@/modules/security/guard";

export default async function FinanzasLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUnlocked("/finanzas");
  return children;
}
