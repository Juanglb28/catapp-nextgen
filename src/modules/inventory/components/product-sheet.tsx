"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { createProductAction, updateProductAction } from "../actions";
import { UNITS, type Unit } from "../validation";

type Initial = {
  id: string;
  name: string;
  unit: string;
  minStock: number;
  costCop: number | null;
};

/** Sheet para crear o editar un producto (F7.B2). */
export function ProductSheet({
  trigger,
  initial,
}: {
  trigger: ReactNode;
  initial?: Initial;
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState<Unit>((initial?.unit as Unit) ?? "unidad");
  const [initialStock, setInitialStock] = useState("0");
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0));
  const [cost, setCost] = useState(initial?.costCop ?? 0);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (name.trim() === "") {
      toast.error("Ponle un nombre");
      return;
    }
    setPending(true);
    const payload = {
      name: name.trim(),
      unit,
      minStock: Number(minStock.replace(",", ".")) || 0,
      costCop: cost > 0 ? cost : null,
      ...(editing
        ? {}
        : { initialStock: Number(initialStock.replace(",", ".")) || 0 }),
    };
    const r = editing
      ? await updateProductAction(initial!.id, payload)
      : await createProductAction(payload);
    setPending(false);
    if (r.ok) {
      setOpen(false);
      toast.success(editing ? "Producto actualizado" : "Producto creado");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>
            {editing ? "Editar producto" : "Nuevo producto"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Esmalte rojo, lima, algodón…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min">Stock mínimo</Label>
              <Input
                id="min"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
          </div>

          {editing ? null : (
            <div className="space-y-2">
              <Label htmlFor="init">Stock inicial</Label>
              <Input
                id="init"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cost">Costo unitario (opcional)</Label>
            <MoneyInput id="cost" value={cost} onChange={setCost} />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? "Guardando…" : editing ? "Guardar" : "Crear producto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
