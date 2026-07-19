import type { Metadata } from "next";

import { ProductList } from "@/modules/inventory/components/product-list";
import { listProducts } from "@/modules/inventory/repository";
import { requireTenant } from "@/modules/tenancy/context";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const { tenantId } = await requireTenant();
  const products = await listProducts(tenantId);

  return (
    <div className="pb-24">
      <ProductList products={products} />
    </div>
  );
}
