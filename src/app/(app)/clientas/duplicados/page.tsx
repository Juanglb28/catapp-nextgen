import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DuplicateResolver } from "@/modules/clients/components/duplicate-resolver";
import { findDuplicateClientGroups } from "@/modules/clients/repository";
import { requireTenant } from "@/modules/tenancy/context";

export const metadata: Metadata = { title: "Clientas duplicadas" };
export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const { tenantId } = await requireTenant();
  const groups = await findDuplicateClientGroups(tenantId);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/clientas">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Clientas duplicadas
          </h1>
          {groups.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {groups.length}{" "}
              {groups.length === 1 ? "grupo encontrado" : "grupos encontrados"}{" "}
              · Elige cuál conservar en cada uno
            </p>
          )}
        </div>
      </div>

      <DuplicateResolver groups={groups} />
    </div>
  );
}
