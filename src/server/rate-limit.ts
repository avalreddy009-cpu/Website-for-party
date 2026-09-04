/**
 * Per-key fixed-window counter held in process memory. Enough to stop someone
 * hammering the verification endpoint from one machine; swap for Redis or an
 * edge rate limiter when this runs on more than one node.
 */
type Window = { count: number; resetAt: number };

const globalRef = globalThis as typeof globalThis & {
  __utopiaRateLimit?: Map<string, Window>;
};
const buckets = (globalRef.__utopiaRateLimit ??= new Map<string, Window>());

// Without this the map grows one entry per IP per scope for the life of the
// process, which on a long-lived node is a slow memory leak.
const MAX_BUCKETS = 20_000;

function evictExpired(now: number): void {
  for (const [key, window] of buckets) {
    if (now > window.resetAt) buckets.delete(key);
  }
  if (buckets.size <= MAX_BUCKETS) return;
  // Still too big: drop oldest-inserted keys, since Map preserves insertion order.
  const excess = buckets.size - MAX_BUCKETS;
  let dropped = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++dropped >= excess) break;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    if (buckets.size >= MAX_BUCKETS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Client identity for rate limiting. Anyone can send their own
 * `X-Forwarded-For`, so the leftmost entry is attacker-controlled and using it
 * hands out a fresh bucket per request. Prefer the headers the platform writes
 * itself, and otherwise take the *last* hop — the one our nearest proxy
 * appended.
 */
export function clientKey(request: Request, scope: string): string {
  const headers = request.headers;
  const trusted =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip");

  let ip = trusted?.split(",").pop()?.trim();
  if (!ip) {
    const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
    ip = hops.pop()?.trim();
  }

  return `${scope}:${ip || "local"}`;
}
