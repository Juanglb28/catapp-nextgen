"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ServiceSheet } from "./service-sheet";

/** Botón "Nuevo servicio" que abre el sheet de creación. */
export function NewServiceButton() {
  return (
    <ServiceSheet
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Nuevo
        </Button>
      }
    />
  );
}
