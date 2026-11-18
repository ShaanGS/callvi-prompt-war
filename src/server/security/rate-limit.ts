import { DomainError } from "../errors";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single instance and for
 * development. On multi-instance deployments, replace the store with a shared
 * one before scaling beyond the single Cloud Run instance used for the demo.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new DomainError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", {
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    });
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
