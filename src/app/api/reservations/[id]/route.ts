// src/app/api/reservations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        inventory: {
          include: { product: true, warehouse: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Check if pending reservation has expired
    if (
      reservation.status === "pending" &&
      reservation.expiresAt < new Date()
    ) {
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: "released" },
        }),
        prisma.inventory.update({
          where: { id: reservation.inventoryId },
          data: { reservedUnits: { decrement: reservation.quantity } },
        }),
      ]);

      return NextResponse.json(
        { error: "RESERVATION_EXPIRED" },
        { status: 410 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("GET /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status === "confirmed") {
      return NextResponse.json(
        { error: "Cannot cancel a confirmed reservation" },
        { status: 400 }
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "released" },
      }),
      prisma.inventory.update({
        where: { id: reservation.inventoryId },
        data: { reservedUnits: { decrement: reservation.quantity } },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("DELETE /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
