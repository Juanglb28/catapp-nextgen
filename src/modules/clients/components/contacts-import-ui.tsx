"use client";

import {
  Cake,
  CheckSquare,
  Loader2,
  Search,
  Square,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { importContactsAction } from "../actions";
import type { PreparedContact } from "../google-contacts";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Devuelve true si el birthdayDate (YYYY-MM-DD) coincide con el día/mes de hoy. */
function isBirthdayToday(birthdayDate: string): boolean {
  const today = new Date();
  const [, month, day] = birthdayDate.split("-").map(Number);
  return today.getMonth() + 1 === month && today.getDate() === day;
}

/** Formatea "YYYY-MM-DD" a "12 mar" para mostrar en el badge. */
function formatBirthdayShort(birthdayDate: string): string {
  const [year, month, day] = birthdayDate.split("-").map(Number);
  const date = new Date(year > 1900 ? year : 2000, month - 1, day);
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function BirthdayBadge({ birthdayDate }: { birthdayDate: string }) {
  const isToday = isBirthdayToday(birthdayDate);
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isToday
          ? "bg-pink-100 text-pink-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Cake className="size-3" aria-hidden="true" />
      {isToday ? "¡Hoy!" : formatBirthdayShort(birthdayDate)}
    </span>
  );
}

type ImportState =
  | { phase: "idle" }
  | { phase: "done"; imported: number; skipped: number }
  | { phase: "error"; message: string };

export function ContactsImportUI({
  contacts,
}: {
  contacts: PreparedContact[];
}) {
  const importable = useMemo(
    () => contacts.filter((c) => c.importable),
    [contacts],
  );

  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  /** Modo lote: activa checkboxes y botón de importar en bloque. */
  const [batchMode, setBatchMode] = useState(false);
  /** Lote acumulado: resourceNames a importar. Persiste entre búsquedas. */
  const [batch, setBatch] = useState<Set<string>>(new Set());
  const [state, setState] = useState<ImportState>({ phase: "idle" });
  const [isPending, startTransition] = useTransition();

  const isFiltered = query.trim() !== "" || activeLetter !== null;

  /** Letras con al menos un contacto importable. */
  const availableLetters = useMemo(
    () => new Set(importable.map((c) => c.name[0]?.toUpperCase() ?? "")),
    [importable],
  );

  /** Contactos importables que coinciden con el filtro activo. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return importable.filter((c) => {
      if (activeLetter && c.name[0]?.toUpperCase() !== activeLetter)
        return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [importable, query, activeLetter]);

  /** Todos los contactos agrupados por primera letra (vista sin filtro). */
  const grouped = useMemo((): Map<string, PreparedContact[]> => {
    const map = new Map<string, PreparedContact[]>();
    for (const c of contacts) {
      const letter = c.name[0]?.toUpperCase() ?? "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    return map;
  }, [contacts]);

  /** Importa un solo contacto de forma inmediata (modo búsqueda). */
  function handleImportOne(contact: PreparedContact) {
    startTransition(async () => {
      const res = await importContactsAction([
        {
          name: contact.name,
          phone: contact.phoneNormalized!,
          email: contact.email ?? "",
          birthdayDate: contact.birthdayDate ?? undefined,
        },
      ]);
      if (res.ok)
        setState({
          phase: "done",
          imported: res.data.imported,
          skipped: res.data.skipped,
        });
      else setState({ phase: "error", message: res.error });
    });
  }

  function toggleBatch(resourceName: string) {
    setBatch((prev) => {
      const next = new Set(prev);
      if (next.has(resourceName)) next.delete(resourceName);
      else next.add(resourceName);
      return next;
    });
  }

  function toggleGroupInBatch(group: PreparedContact[]) {
    const importableInGroup = group.filter((c) => c.importable);
    const allIn = importableInGroup.every((c) => batch.has(c.resourceName));
    setBatch((prev) => {
      const next = new Set(prev);
      if (allIn) importableInGroup.forEach((c) => next.delete(c.resourceName));
      else importableInGroup.forEach((c) => next.add(c.resourceName));
      return next;
    });
  }

  const allFilteredInBatch =
    filtered.length > 0 && filtered.every((c) => batch.has(c.resourceName));
  const allImportableInBatch =
    importable.length > 0 && importable.every((c) => batch.has(c.resourceName));

  function toggleAllFiltered() {
    setBatch((prev) => {
      const next = new Set(prev);
      if (allFilteredInBatch)
        filtered.forEach((c) => next.delete(c.resourceName));
      else filtered.forEach((c) => next.add(c.resourceName));
      return next;
    });
  }

  function toggleAllImportable() {
    if (allImportableInBatch) {
      setBatch(new Set());
    } else {
      setBatch(new Set(importable.map((c) => c.resourceName)));
    }
  }

  function handleImportBatch() {
    const toImport = importable
      .filter((c) => batch.has(c.resourceName))
      .map((c) => ({
        name: c.name,
        phone: c.phoneNormalized!,
        email: c.email ?? "",
        birthdayDate: c.birthdayDate ?? undefined,
      }));

    startTransition(async () => {
      const res = await importContactsAction(toImport);
      if (res.ok)
        setState({
          phase: "done",
          imported: res.data.imported,
          skipped: res.data.skipped,
        });
      else setState({ phase: "error", message: res.error });
    });
  }

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (state.phase === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="bg-brand-gradient flex size-16 items-center justify-center rounded-full">
          <Users className="size-8 text-white" />
        </div>
        <div>
          <p className="text-lg font-semibold">
            {state.imported === 0
              ? "Sin cambios"
              : `${state.imported} ${state.imported === 1 ? "clienta importada" : "clientas importadas"}`}
          </p>
          {state.skipped > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {state.skipped} omitidas (ya existían o teléfono inválido)
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/clientas">Ver clientas</Link>
        </Button>
      </div>
    );
  }

  // ── Sin contactos ──────────────────────────────────────────────────────────
  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No se encontraron contactos en tu cuenta de Google.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-36">
      {/* Error de acción */}
      {state.phase === "error" && (
        <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
          {state.message}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveLetter(null);
          }}
          className="pr-9 pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-3 -translate-y-1/2"
            aria-label="Limpiar búsqueda"
          >
            <X className="text-muted-foreground size-4" />
          </button>
        )}
      </div>

      {/* Toggle modo lote */}
      <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
        <button
          type="button"
          role="checkbox"
          aria-checked={batchMode}
          onClick={() => {
            setBatchMode((v) => !v);
            setBatch(new Set());
            setActiveLetter(null);
          }}
          className="flex-shrink-0"
        >
          {batchMode ? (
            <CheckSquare className="text-primary size-5" />
          ) : (
            <Square className="text-muted-foreground size-5" />
          )}
        </button>
        <span
          className={
            batchMode ? "text-primary font-medium" : "text-muted-foreground"
          }
        >
          Importar por lotes
        </span>
        {batchMode && batch.size > 0 && (
          <span className="text-primary font-medium">
            · {batch.size} seleccionadas
          </span>
        )}
      </label>

      {/* Abecedario horizontal — solo en modo lote */}
      {batchMode && (
        <div
          className="flex gap-0.5 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {ALPHABET.map((letter) => {
            const available = availableLetters.has(letter);
            const active = activeLetter === letter;
            return (
              <button
                key={letter}
                type="button"
                disabled={!available}
                onClick={() => {
                  setActiveLetter((prev) => (prev === letter ? null : letter));
                  setQuery("");
                }}
                className={cn(
                  "min-w-[26px] flex-shrink-0 rounded px-1.5 py-1 text-xs font-bold transition-colors",
                  active
                    ? "bg-brand text-white"
                    : available
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground/25 cursor-not-allowed",
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de estado — solo en modo lote */}
      {batchMode && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isFiltered
              ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`
              : `${importable.length} de ${contacts.length} importables`}
          </span>

          {isFiltered && filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="text-primary flex items-center gap-1 font-medium"
            >
              {allFilteredInBatch ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
              {allFilteredInBatch ? "Quitar todos" : "Todos al lote"}
            </button>
          )}

          {!isFiltered && importable.length > 0 && (
            <button
              type="button"
              onClick={toggleAllImportable}
              className="text-primary flex items-center gap-1 font-medium"
            >
              {allImportableInBatch ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
              {allImportableInBatch ? "Quitar todos" : "Seleccionar todos"}
            </button>
          )}
        </div>
      )}

      {/* ── Resultados de búsqueda ─────────────────────────────────────────── */}
      {isFiltered && (
        <>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Sin resultados.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {filtered.map((contact) => {
                const inBatch = batch.has(contact.resourceName);
                return (
                  <li
                    key={contact.resourceName}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      batchMode && inBatch && "bg-primary/5",
                    )}
                  >
                    {batchMode ? (
                      <button
                        type="button"
                        onClick={() => toggleBatch(contact.resourceName)}
                        className="flex-shrink-0"
                        aria-label={
                          inBatch ? "Quitar del lote" : "Añadir al lote"
                        }
                      >
                        {inBatch ? (
                          <CheckSquare className="text-primary size-5" />
                        ) : (
                          <Square className="text-muted-foreground size-5" />
                        )}
                      </button>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {contact.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {contact.phone ?? "—"}
                        {contact.email ? ` · ${contact.email}` : ""}
                      </p>
                    </div>
                    {contact.birthdayDate && (
                      <BirthdayBadge birthdayDate={contact.birthdayDate} />
                    )}
                    {batchMode && inBatch && (
                      <span className="text-primary flex-shrink-0 text-xs font-medium">
                        En lote
                      </span>
                    )}
                    {!batchMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleImportOne(contact)}
                        className="flex-shrink-0"
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Importar"
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ── Vista agrupada por letra (sin filtro, solo modo lote) ─────────── */}
      {!isFiltered && batchMode && (
        <div className="space-y-4">
          {[...grouped.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "es"))
            .map(([letter, group]) => {
              const importableGroup = group.filter((c) => c.importable);
              const allGroupInBatch =
                importableGroup.length > 0 &&
                importableGroup.every((c) => batch.has(c.resourceName));
              return (
                <div key={letter}>
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      {letter}
                    </span>
                    {importableGroup.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleGroupInBatch(group)}
                        className="text-primary text-xs font-medium"
                      >
                        {allGroupInBatch ? "Quitar" : "Todos"}
                      </button>
                    )}
                  </div>
                  <ul className="divide-y rounded-xl border">
                    {group.map((contact) => {
                      const inBatch = batch.has(contact.resourceName);
                      return (
                        <li
                          key={contact.resourceName}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3",
                            !contact.importable && "opacity-40",
                            inBatch && "bg-primary/5",
                          )}
                        >
                          <button
                            type="button"
                            disabled={!contact.importable}
                            onClick={() => toggleBatch(contact.resourceName)}
                            className="flex-shrink-0"
                            aria-label={
                              inBatch ? "Quitar del lote" : "Añadir al lote"
                            }
                          >
                            {inBatch ? (
                              <CheckSquare className="text-primary size-5" />
                            ) : (
                              <Square className="text-muted-foreground size-5" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {contact.name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {contact.phone ?? "—"}
                              {contact.email ? ` · ${contact.email}` : ""}
                            </p>
                          </div>
                          {contact.birthdayDate && (
                            <BirthdayBadge
                              birthdayDate={contact.birthdayDate}
                            />
                          )}
                          {!contact.importable && contact.skipReason && (
                            <span className="text-muted-foreground flex-shrink-0 text-xs">
                              {contact.skipReason}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
        </div>
      )}

      {/* Mensaje de ayuda cuando no hay búsqueda activa y modo normal */}
      {!isFiltered && !batchMode && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Escribe un nombre para buscar entre tus {importable.length} contactos
          importables.
        </p>
      )}

      {/* Botón de importar lote — fijo en la parte inferior */}
      {batchMode && batch.size > 0 && (
        <div className="fixed right-0 bottom-20 left-0 z-10 px-4 pb-2">
          <Button
            onClick={handleImportBatch}
            disabled={isPending}
            className="w-full shadow-lg"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importando…
              </>
            ) : (
              `Importar lote · ${batch.size} ${batch.size === 1 ? "clienta" : "clientas"}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
