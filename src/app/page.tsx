import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReserveButton } from "@/components/ReserveButton";

interface Inventory {
  id: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  warehouse: {
    id: string;
    name: string;
    city: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  inventories: Inventory[];
}

export default async function Home() {
  const res = await fetch("http://localhost:3000/api/products", {
    cache: "no-store",
  });
  const products: Product[] = await res.json();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Allo Inventory
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          Reserve before someone else does
        </p>
      </div>

      {/* Product Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card
            key={product.id}
            className="overflow-hidden shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg leading-tight">
                  {product.name}
                </CardTitle>
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  {product.sku}
                </Badge>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                ₹{Number(product.price).toLocaleString("en-IN")}
              </p>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                Warehouse Availability
              </p>
              <div className="space-y-3">
                {product.inventories.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-700">
                        {inv.warehouse.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {inv.warehouse.city}
                      </p>
                    </div>
                    <ReserveButton
                      inventoryId={inv.id}
                      availableUnits={inv.availableUnits}
                      productName={product.name}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
