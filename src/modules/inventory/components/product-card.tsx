"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { isLowStock } from "../domain";
import type { ProductRow } from "../repository";
import { MovementSheet } from "./movement-sheet";

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function ProductCard({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [stock, setStock] = useState(product.stock);
  const [sheet, setSheet] = useState<{ open: boolean; type: "in" | "out" }>({
    open: false,
    type: "out",
  });

  const low = isLowStock(stock, product.minStock);

  function onSuccess(delta: number) {
    setStock((s) => Math.max(0, s + delta)); // optimista
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <Link href={`/inventario/${product.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {formatQty(stock)} {product.unit}
          </span>
          {low ? (
            <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
              Stock bajo
            </Badge>
          ) : null}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Registrar salida"
          onClick={() => setSheet({ open: true, type: "out" })}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Registrar entrada"
          onClick={() => setSheet({ open: true, type: "in" })}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <MovementSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        productId={product.id}
        productName={product.name}
        unit={product.unit}
        type={sheet.type}
        onSuccess={onSuccess}
      />
    </div>
  );
}
