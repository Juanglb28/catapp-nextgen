"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ProductRow } from "../repository";
import { ProductCard } from "./product-card";
import { ProductSheet } from "./product-sheet";

export function ProductList({ products }: { products: ProductRow[] }) {
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const lowCount = useMemo(
    () => products.filter((p) => p.lowStock).length,
    [products],
  );

  const filtered = products.filter((p) => {
    if (lowOnly && !p.lowStock) return false;
    const q = query.trim().toLowerCase();
    return q === "" || p.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <ProductSheet
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Nuevo
            </Button>
          }
        />
      </div>

      <Input
        type="search"
        placeholder="Buscar producto"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button
        type="button"
        onClick={() => setLowOnly((v) => !v)}
        className={cn(
          "rounded-full border px-3 py-1 text-sm",
          lowOnly
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "text-muted-foreground",
        )}
      >
        Solo stock bajo{lowCount > 0 ? ` (${lowCount})` : ""}
      </button>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {products.length === 0
            ? "Aún no tienes productos. Crea el primero con “Nuevo”."
            : "Ningún producto coincide."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
