// src/app/api/cron/release-expired/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("Authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;

    if (!authHeader || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all expired pending reservations
    const expired = await prisma.reservation.findMany({
      where: {
        status: "pending",
        expiresAt: { lt: new Date() },
      },
    });

    // Release each one in a transaction
    for (const reservation of expired) {
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

    return NextResponse.json({ released: expired.length });
  } catch (error) {
    console.error("POST /api/cron/release-expired error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
