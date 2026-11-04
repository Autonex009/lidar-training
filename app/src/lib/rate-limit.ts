/**
 * Minimal fixed-window rate limiter. State is an in-memory Map, so it is PER PROCESS:
 * with several server instances (or serverless) each keeps its own counters, and a restart resets them.
 * Replace with a shared store (Redis, DB) if you scale out.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function loginLimitPerMinute(): number {
  const n = Number(process.env.LOGIN_RATE_LIMIT_PER_MIN);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

/** Records one hit; returns true if the caller is over `limit` within the current window. */
export function hitRateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): boolean {
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1 > limit;
  }
  b.count += 1;
  return b.count > limit;
}

export function isRateLimited(key: string, limit: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  return Boolean(b && b.resetAt > now && b.count > limit);
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(headers: Headers | { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  return (xff?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown").slice(0, 64);
}
