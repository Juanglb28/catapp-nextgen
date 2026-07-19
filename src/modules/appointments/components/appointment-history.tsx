"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type HistoryItem = { when: string; text: string };

/** Sección colapsable con el historial de cambios de la cita. */
export function AppointmentHistory({ items }: { items: HistoryItem[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground flex w-full items-center justify-between py-2 text-sm font-medium"
      >
        <span>Historial de cambios ({items.length})</span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-2 pt-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm">
              <span className="text-muted-foreground">{item.when} — </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
