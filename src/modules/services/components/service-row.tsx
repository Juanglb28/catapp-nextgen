"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/duration";
import { formatCOP } from "@/lib/money";

import { activateServiceAction, deactivateServiceAction } from "../actions";
import { type Service } from "../schema";
import { ServiceSheet } from "./service-sheet";

/** Fila de servicio: nombre, precio y duración, con editar y activar/desactivar. */
export function ServiceRow({ service }: { service: Service }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    startTransition(async () => {
      if (service.active) {
        await deactivateServiceAction(service.id);
      } else {
        await activateServiceAction(service.id);
      }
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        !service.active && "border-dashed opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{service.name}</p>
        <p className="text-muted-foreground text-sm">
          {formatCOP(service.basePriceCop)} ·{" "}
          {formatDuration(service.durationMin)}
        </p>
      </div>

      <ServiceSheet
        service={{
          id: service.id,
          values: {
            name: service.name,
            basePriceCop: Number(service.basePriceCop),
            durationMin: service.durationMin,
          },
        }}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Editar servicio">
            <Pencil className="size-4" />
          </Button>
        }
      />

      <Button
        variant={service.active ? "ghost" : "outline"}
        size="sm"
        disabled={pending}
        onClick={onToggle}
      >
        {service.active ? "Desactivar" : "Activar"}
      </Button>
    </li>
  );
}
