import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Acquire a distributed lock using SET NX EX.
 * Returns true if the lock was acquired, false if it's already held.
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  // SET key "1" NX EX ttl → returns "OK" if set, null if key already exists
  const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
  return result === "OK";
}

/**
 * Release a distributed lock by deleting the key.
 */
export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
