// src/app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
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
        { error: "Reservation already confirmed" },
        { status: 400 }
      );
    }

    // Expired pending reservation — release it
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

    if (reservation.status === "released") {
      return NextResponse.json(
        { error: "RESERVATION_ALREADY_RELEASED" },
        { status: 409 }
      );
    }

    // Confirm: status → confirmed, decrement both totalUnits and reservedUnits
    const [confirmed] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "confirmed" },
      }),
      prisma.inventory.update({
        where: { id: reservation.inventoryId },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      }),
    ]);

    return NextResponse.json(confirmed);
  } catch (error) {
    console.error("POST /api/reservations/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
