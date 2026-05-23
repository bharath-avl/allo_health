import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Reset all tables (order matters due to foreign keys)
  await prisma.$transaction([
    prisma.reservation.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.product.deleteMany(),
    prisma.warehouse.deleteMany(),
  ]);

  console.log("🗑️  Cleared existing data");

  // Seed products
  const [headphones, shoes, watch] = await prisma.$transaction([
    prisma.product.create({
      data: {
        name: "Wireless Headphones",
        sku: "WH-001",
        price: 2999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Running Shoes",
        sku: "RS-002",
        price: 4499,
      },
    }),
    prisma.product.create({
      data: {
        name: "Smart Watch",
        sku: "SW-003",
        price: 8999,
      },
    }),
  ]);

  console.log(`📦 Created ${3} products`);

  // Seed warehouses
  const [mumbai, delhi] = await prisma.$transaction([
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central",
        city: "Mumbai",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi North",
        city: "Delhi",
      },
    }),
  ]);

  console.log(`🏭 Created ${2} warehouses`);

  // Seed inventory — each product in each warehouse
  const products = [headphones, shoes, watch];
  const warehouses = [mumbai, delhi];

  await prisma.$transaction(
    products.flatMap((product) =>
      warehouses.map((warehouse) =>
        prisma.inventory.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            totalUnits: 10,
            reservedUnits: 0,
          },
        })
      )
    )
  );

  console.log(`📊 Created ${products.length * warehouses.length} inventory rows`);
  console.log("✅ Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
