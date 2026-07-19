"use client";

import { Pencil, Scale, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { deactivateProductAction } from "../actions";
import { AdjustStockSheet } from "./adjust-stock-sheet";
import { ProductSheet } from "./product-sheet";

export function ProductDetailActions({
  product,
}: {
  product: {
    id: string;
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    costCop: number | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDeactivate() {
    setPending(true);
    await deactivateProductAction(product.id);
    toast.success("Producto desactivado");
    router.push("/inventario");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <AdjustStockSheet
        productId={product.id}
        currentStock={product.stock}
        unit={product.unit}
        trigger={
          <Button variant="outline" size="sm">
            <Scale className="size-4" />
            Ajustar stock
          </Button>
        }
      />
      <ProductSheet
        initial={{
          id: product.id,
          name: product.name,
          unit: product.unit,
          minStock: product.minStock,
          costCop: product.costCop,
        }}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive">
            <Trash2 className="size-4" />
            Desactivar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desactivar “{product.name}”?</DialogTitle>
            <DialogDescription>
              Dejará de aparecer en la lista. Su historial de movimientos se
              conserva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={onDeactivate}
            >
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
