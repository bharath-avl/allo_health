import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReserveButton } from "@/components/ReserveButton";
import { prisma } from "@/lib/prisma";

// Color accents per product index
const CARD_ACCENTS = [
  "border-t-purple-500",
  "border-t-blue-500",
  "border-t-amber-500",
  "border-t-emerald-500",
  "border-t-rose-500",
  "border-t-cyan-500",
];

export default async function Home() {
  // Lazily release expired pending reservations
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
  });

  for (const reservation of expiredReservations) {
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "released" },
      }),
      prisma.inventory.update({
        where: { id: reservation.inventoryId },
        data: { reservedUnits: { decrement: reservation.quantity } },
      }),
    ]);
  }

  // Fetch all products with inventory and warehouse data
  const products = await prisma.product.findMany({
    include: {
      inventories: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute availableUnits per inventory row
  const productsWithAvailability = products.map((product) => ({
    ...product,
    price: product.price.toString(),
    inventories: product.inventories.map((inv) => ({
      ...inv,
      availableUnits: inv.totalUnits - inv.reservedUnits,
    })),
  }));

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-600" />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              allo
            </span>
            <span className="text-lg font-light tracking-tight text-slate-400">
              inventory
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-700"
          >
            <span className="relative mr-2 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Stock Updates
          </Badge>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Inventory Dashboard
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Reserve before someone else does
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {productsWithAvailability.map((product, index) => (
            <Card
              key={product.id}
              className={`overflow-hidden border-t-[3px] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                CARD_ACCENTS[index % CARD_ACCENTS.length]
              }`}
            >
              <CardHeader className="relative pb-3">
                <Badge
                  variant="secondary"
                  className="absolute top-4 right-4 shrink-0 font-mono text-[10px] text-slate-500"
                >
                  {product.sku}
                </Badge>
                <CardTitle className="pr-16 text-xl font-bold leading-tight text-slate-900">
                  {product.name}
                </CardTitle>
                <p className="mt-1">
                  <span className="text-sm text-slate-400">₹</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {Number(product.price).toLocaleString("en-IN")}
                  </span>
                </p>
              </CardHeader>

              <Separator className="mx-4" />

              <CardContent className="pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Warehouse Availability
                </p>
                <div className="space-y-2">
                  {product.inventories.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {inv.warehouse.name}
                        </p>
                        <p className="text-xs text-slate-400">
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

      {/* Footer */}
      <footer className="relative border-t border-slate-200/60 py-6 text-center">
        <p className="text-xs text-slate-400">
          Built for <span className="font-medium text-slate-500">Allo Health</span> · Inventory Reservation System
        </p>
      </footer>
    </div>
  );
}
