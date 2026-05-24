import { Separator } from "@/components/ui/separator";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ReserveButton } from "@/components/ReserveButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// SKU → config
const SKU_CONFIG: Record<string, { bg: string; emoji: string }> = {
  "WH-001": { bg: "bg-violet-50", emoji: "🎧" },
  "RS-002": { bg: "bg-sky-50", emoji: "👟" },
  "SW-003": { bg: "bg-amber-50", emoji: "⌚" },
};

const DEFAULT_CONFIG = { bg: "bg-slate-50", emoji: "📦" };

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
      {/* ── Navbar ───────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-baseline">
            <span className="text-base font-semibold text-slate-900">allo</span>
            <span className="ml-1 text-sm font-normal text-slate-400">
              inventory
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="bg-white px-6 py-20 text-center">
        <AnimatedGradientText className="text-5xl font-bold tracking-tight">
          Reserve before someone else does
        </AnimatedGradientText>
        <p className="mt-4 text-base text-slate-400">
          Units held for 10 minutes · First come, first served
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-wide text-slate-300">
          <span>{totalProducts} Products</span>
          <span>·</span>
          <span>{totalWarehouses} Warehouses</span>
          <span>·</span>
          <span>Real-time locking</span>
        </div>
      </section>

      {/* ── Product Grid ─────────────────────────────── */}
      <main className="flex-1 px-6 pb-20 pt-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {productsWithAvailability.map((product) => {
            const config = SKU_CONFIG[product.sku] ?? DEFAULT_CONFIG;

            return (
              <div key={product.id} className="relative overflow-hidden rounded-2xl">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  {/* Product Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${config.bg}`}
                    >
                      {config.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {product.name}
                      </h3>
                      <p className="font-[family-name:var(--font-mono)] text-xs text-slate-400">
                        {product.sku}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mt-3">
                    <span className="text-sm text-slate-400">₹</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {Number(product.price).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <Separator className="my-4" />

                  {/* Warehouse Stock */}
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                    Stock by Location
                  </p>

                  <div className="space-y-1">
                    {product.inventories.map((inv) => (
                      <div key={inv.id}>
                        <div className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700">
                              {inv.warehouse.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {inv.warehouse.city}
                            </p>
                          </div>

                          {inv.availableUnits === 0 ? (
                            <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs text-red-400">
                              Sold out
                            </span>
                          ) : inv.availableUnits <= 2 ? (
                            <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
                              <NumberTicker
                                value={inv.availableUnits}
                                className="text-xs font-medium text-amber-700"
                              />{" "}
                              left
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                              <NumberTicker
                                value={inv.availableUnits}
                                className="text-xs font-medium text-emerald-700"
                              />{" "}
                              left
                            </span>
                          )}
                        </div>

                        {/* Reserve button — not shown if sold out */}
                        <ReserveButton
                          inventoryId={inv.id}
                          availableUnits={inv.availableUnits}
                          productName={product.name}
                        />

                        {product.inventories.indexOf(inv) <
                          product.inventories.length - 1 && (
                          <Separator className="my-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Animated border beam */}
                <BorderBeam
                  duration={8}
                  size={200}
                  className="from-violet-500/20 via-violet-300/40 to-violet-500/20"
                />
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-8 text-center">
        <p className="text-xs text-slate-300">
          Allo Health Inventory · Built with Next.js, Prisma & Redis
        </p>
      </footer>
    </div>
  );
}
