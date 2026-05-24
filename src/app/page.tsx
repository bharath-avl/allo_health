import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReserveButton, StockBadge } from "@/components/ReserveButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// SKU → accent color + emoji
const SKU_CONFIG: Record<string, { border: string; bg: string; emoji: string }> = {
  "WH-001": { border: "border-l-indigo-500", bg: "bg-indigo-50", emoji: "🎧" },
  "RS-002": { border: "border-l-sky-500", bg: "bg-sky-50", emoji: "👟" },
  "SW-003": { border: "border-l-amber-500", bg: "bg-amber-50", emoji: "⌚" },
};

const DEFAULT_CONFIG = { border: "border-l-slate-400", bg: "bg-slate-50", emoji: "📦" };

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

  const totalProducts = products.length;
  const totalWarehouses = new Set(
    products.flatMap((p) => p.inventories.map((i) => i.warehouseId))
  ).size;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Dark Navbar ──────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          {/* Brand */}
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold italic text-white tracking-tight">
              allo
            </span>
            <sup className="ml-1 text-[10px] font-medium text-purple-400 tracking-wide">
              inventory
            </sup>
          </div>

          {/* Right side indicators */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────── */}
      <section className="border-b border-slate-100 bg-white px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Reserve before someone else does
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
          Real-time stock tracking. First come, first served.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>{totalProducts} Products</span>
          <span className="text-slate-300">·</span>
          <span>{totalWarehouses} Warehouses</span>
          <span className="text-slate-300">·</span>
          <span>Units held in real-time</span>
        </div>
      </section>

      {/* ── Product Grid ─────────────────────────────── */}
      <main className="flex-1 bg-slate-50/50 px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {productsWithAvailability.map((product) => {
            const config = SKU_CONFIG[product.sku] ?? DEFAULT_CONFIG;

            return (
              <Card
                key={product.id}
                className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md border-l-4 ${config.border}`}
              >
                <CardContent className="p-5">
                  {/* Product Header */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${config.bg}`}
                    >
                      {config.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold leading-tight text-slate-900">
                        {product.name}
                      </h3>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {product.sku}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mt-4">
                    <span className="text-sm text-slate-400">₹</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {Number(product.price).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <Separator className="my-4" />

                  {/* Warehouse Stock */}
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Stock by Location
                  </p>

                  <div className="space-y-1.5">
                    {product.inventories.map((inv) => (
                      <div key={inv.id}>
                        <div className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">📍</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">
                                {inv.warehouse.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {inv.warehouse.city}
                              </p>
                            </div>
                          </div>
                          <StockBadge availableUnits={inv.availableUnits} />
                        </div>

                        {/* Reserve button per warehouse */}
                        <div className="mt-1.5 px-1">
                          <ReserveButton
                            inventoryId={inv.id}
                            availableUnits={inv.availableUnits}
                            productName={product.name}
                          />
                        </div>

                        {/* Spacer between warehouse rows */}
                        {product.inventories.indexOf(inv) <
                          product.inventories.length - 1 && (
                          <Separator className="my-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* ── Dark Footer ──────────────────────────────── */}
      <footer className="bg-[#0f172a] px-6 py-6 text-center">
        <p className="text-xs text-slate-500">
          Allo Health Inventory System · Built with Next.js, Prisma, Redis
        </p>
      </footer>
    </div>
  );
}
