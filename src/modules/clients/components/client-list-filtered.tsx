"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

import { type Client } from "../schema";
import { ClientCard } from "./client-card";

/** Normaliza un nombre a su letra inicial en mayúscula (A–Z o #). */
function initialLetter(name: string): string {
  const ch = name.trim()[0]?.toUpperCase() ?? "#";
  return /^[A-Z]$/.test(ch) ? ch : "#";
}

/** Lista de clientas activas con búsqueda en tiempo real + índice alfabético. */
export function ClientListFiltered({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  // Letras disponibles (solo las que tienen al menos 1 clienta).
  const availableLetters = useMemo(() => {
    const set = new Set(clients.map((c) => initialLetter(c.name)));
    const sorted = [...set].sort();
    // Poner "#" al final si existe.
    if (sorted[0] === "#") sorted.push(sorted.shift()!);
    return sorted;
  }, [clients]);

  // Lista filtrada: búsqueda tiene prioridad sobre letra.
  const filtered = useMemo(() => {
    if (q) {
      return clients.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
      );
    }
    if (activeLetter) {
      return clients.filter((c) => initialLetter(c.name) === activeLetter);
    }
    return clients;
  }, [clients, q, activeLetter]);

  // Agrupados por letra (solo cuando no hay búsqueda activa).
  const groups = useMemo(() => {
    if (q) return null;
    const map = new Map<string, Client[]>();
    for (const c of filtered) {
      const l = initialLetter(c.name);
      const bucket = map.get(l);
      if (bucket) bucket.push(c);
      else map.set(l, [c]);
    }
    return map;
  }, [filtered, q]);

  function handleLetterClick(letter: string) {
    setActiveLetter((prev) => (prev === letter ? null : letter));
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (val) setActiveLetter(null); // la búsqueda borra la letra activa
  }

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          aria-label="Buscar clientas"
          placeholder="Buscar por nombre o teléfono"
          className="pl-9"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Índice alfabético — visible solo cuando no hay búsqueda activa */}
      {!q && availableLetters.length > 1 && (
        <div
          className="flex scrollbar-none gap-1 overflow-x-auto pb-0.5"
          aria-label="Filtrar por letra"
        >
          {availableLetters.map((letter) => (
            <button
              key={letter}
              onClick={() => handleLetterClick(letter)}
              className={[
                "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                activeLetter === letter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
              aria-pressed={activeLetter === letter}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length > 0 ? (
        q || !groups ? (
          // Vista plana (búsqueda activa)
          <ul className="space-y-2">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </ul>
        ) : (
          // Vista agrupada por letra
          <div className="space-y-4">
            {[...groups.entries()].map(([letter, group]) => (
              <div key={letter}>
                <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-widest uppercase">
                  {letter}
                </p>
                <ul className="space-y-2">
                  {group.map((client) => (
                    <ClientCard key={client.id} client={client} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {q
            ? `Ninguna clienta coincide con "${query}".`
            : activeLetter
              ? `No tienes clientas con "${activeLetter}".`
              : "No tienes clientas activas."}
        </p>
      )}
    </div>
  );
}
