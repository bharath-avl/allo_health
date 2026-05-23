import { Redis } from "@upstash/redis";

// Redis is optional — if env vars are missing, lock/idempotency features
// are skipped gracefully (app still works, just without distributed locking).
const hasRedisConfig =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Acquire a distributed lock using SET NX EX.
 * Returns true if the lock was acquired, false if it's already held.
 * If Redis is not configured, always returns true (no-op).
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  if (!redis) return true;
  // SET key "1" NX EX ttl → returns "OK" if set, null if key already exists
  const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
  return result === "OK";
}

/**
 * Release a distributed lock by deleting the key.
 * If Redis is not configured, this is a no-op.
 */
export async function releaseLock(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}
