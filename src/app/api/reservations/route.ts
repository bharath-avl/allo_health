// src/app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createReservation } from "@/lib/reserve";

const ReservationSchema = z.object({
  inventoryId: z.string().min(1),
  quantity: z.int().min(1).max(10),
  sessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? undefined;

    const result = await createReservation({
      ...parsed.data,
      idempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.reason,
          ...(result.available !== undefined && {
            available: result.available,
          }),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result.reservation, { status: 200 });
  } catch (error) {
    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
