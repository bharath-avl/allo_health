// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
    const result = products.map((product) => ({
      ...product,
      inventories: product.inventories.map((inv) => ({
        ...inv,
        availableUnits: inv.totalUnits - inv.reservedUnits,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
