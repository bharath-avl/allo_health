import { Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis, acquireLock, releaseLock } from "@/lib/redis";

// ── Types ──────────────────────────────────────────────

interface ReserveParams {
  inventoryId: string;
  quantity: number;
  sessionId: string;
  idempotencyKey?: string;
}

type ReserveResult =
  | { success: true; reservation: Reservation }
  | {
      success: false;
      reason: "LOCK_FAILED" | "NOT_ENOUGH_STOCK";
      available?: number;
    };

// ── Constants ──────────────────────────────────────────

const LOCK_TTL_SECONDS = 5;
const RESERVATION_TTL_MINUTES = 10;
const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

// ── Main function ──────────────────────────────────────

export async function createReservation(
  params: ReserveParams
): Promise<ReserveResult> {
  const { inventoryId, quantity, sessionId, idempotencyKey } = params;

  // 1. Idempotency check — return cached result if this key was already processed
  if (idempotencyKey && redis) {
    const cached = await redis.get<ReserveResult>(
      `idempotency:${idempotencyKey}`
    );
    if (cached) return cached;
  }

  // 2. Acquire distributed lock on this inventory row
  const lockKey = `lock:inv:${inventoryId}`;
  const locked = await acquireLock(lockKey, LOCK_TTL_SECONDS);

  if (!locked) {
    return { success: false, reason: "LOCK_FAILED" };
  }

  // 3. Perform reservation inside lock, always release in finally
  try {
    // Read current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      return { success: false, reason: "NOT_ENOUGH_STOCK", available: 0 };
    }

    const available = inventory.totalUnits - inventory.reservedUnits;

    if (available < quantity) {
      return { success: false, reason: "NOT_ENOUGH_STOCK", available };
    }

    // Atomically update inventory + create reservation in a single transaction
    const expiresAt = new Date(
      Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
    );

    const [, reservation] = await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { reservedUnits: { increment: quantity } },
      }),
      prisma.reservation.create({
        data: {
          inventoryId,
          sessionId,
          quantity,
          status: "pending",
          expiresAt,
          idempotencyKey: idempotencyKey ?? null,
        },
      }),
    ]);

    const result: ReserveResult = { success: true, reservation };

    // Cache result for idempotency
    if (idempotencyKey && redis) {
      await redis.set(`idempotency:${idempotencyKey}`, result, {
        ex: IDEMPOTENCY_TTL_SECONDS,
      });
    }

    return result;
  } finally {
    await releaseLock(lockKey);
  }
}
