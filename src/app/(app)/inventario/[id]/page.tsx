import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { ProductDetailActions } from "@/modules/inventory/components/product-detail-actions";
import { movementDelta } from "@/modules/inventory/domain";
import { getProduct, listMovements } from "@/modules/inventory/repository";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";

export const metadata: Metadata = { title: "Producto" };
export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  adjust: "Ajuste",
};

const PER_PAGE = 20;

function formatQty(n: number): string {
  const v = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(2);
  return `${n >= 0 ? "+" : "−"}${v}`;
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const { offset: offsetParam } = await searchParams;

  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const product = await getProduct(tenantId, id);
  if (!product) notFound();

  const offset = Math.max(0, Number(offsetParam) || 0);
  const { items, hasMore } = await listMovements(tenantId, id, {
    limit: PER_PAGE,
    offset,
  });

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link
          href="/inventario"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Inventario
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {product.name}
          {product.lowStock ? (
            <Badge variant="destructive" className="text-xs">
              Stock bajo
            </Badge>
          ) : null}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {product.stock} {product.unit} en stock · mínimo {product.minStock}
          {product.costCop !== null
            ? ` · costo ${formatCOP(product.costCop)}`
            : ""}
        </p>
      </div>

      <ProductDetailActions
        product={{
          id: product.id,
          name: product.name,
          unit: product.unit,
          stock: product.stock,
          minStock: product.minStock,
          costCop: product.costCop === null ? null : Number(product.costCop),
        }}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Movimientos</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin movimientos aún.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map((m) => {
              const signed = movementDelta(m.type, Number(m.quantity));
              return (
                <li key={m.id} className="px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {MOVEMENT_LABEL[m.type] ?? m.type}
                    </span>
                    <span
                      className={
                        signed >= 0 ? "text-green-600" : "text-destructive"
                      }
                    >
                      {formatQty(signed)} {product.unit}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(m.createdAt, tz)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {(offset > 0 || hasMore) && (
          <div className="flex justify-between pt-1">
            {offset > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/inventario/${id}?offset=${Math.max(0, offset - PER_PAGE)}`}
                >
                  ← Anteriores
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {hasMore ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/inventario/${id}?offset=${offset + PER_PAGE}`}>
                  Más antiguos →
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
