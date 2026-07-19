"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ClientSheet } from "./client-sheet";

/**
 * Botón flotante "+" para registrar una clienta. Se ancla a la esquina inferior
 * derecha de la columna (max-w-md), justo encima de la bottom-nav.
 */
export function NewClientFab() {
  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-40 mx-auto w-full max-w-md -translate-x-1/2">
      <div className="flex justify-end pr-4 pb-24">
        <ClientSheet
          trigger={
            <Button
              size="icon"
              aria-label="Nueva clienta"
              className="pointer-events-auto size-14 rounded-full shadow-lg"
            >
              <Plus className="size-6" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
