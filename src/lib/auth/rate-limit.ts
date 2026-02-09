/**
 * In-memory token bucket rate limiter.
 *
 * Each identifier (userId or IP) gets a bucket that starts with `maxTokens`
 * tokens. On every request one token is consumed. Tokens refill at
 * `refillRate` tokens per second. When the bucket is empty the request is
 * rejected with a 429 response.
 */

export interface RateLimitConfig {
  /** Maximum burst size / tokens in the bucket. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
  /** Interval (ms) for cleaning up stale buckets. Default 60 000. */
  cleanupIntervalMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until at least one token is available again. */
  resetMs: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// ---------------------------------------------------------------------------
// Bucket store (module-level singleton)
// ---------------------------------------------------------------------------

const buckets = new Map<string, Bucket>();

// Periodic cleanup of stale buckets (full + idle for 5 min)
const STALE_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(cleanupIntervalMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > STALE_MS) {
        buckets.delete(key);
      }
    }
    // If map is empty, stop the timer
    if (buckets.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, cleanupIntervalMs);
  // Allow the Node process to exit even if the timer is still running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

export function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const cleanupIntervalMs = config.cleanupIntervalMs ?? 60_000;

  ensureCleanupTimer(cleanupIntervalMs);

  let bucket = buckets.get(identifier);

  if (!bucket) {
    // First request — create a full bucket and consume one token
    bucket = { tokens: config.maxTokens - 1, lastRefill: now };
    buckets.set(identifier, bucket);
    return { allowed: true, remaining: bucket.tokens, resetMs: 0 };
  }

  // Refill tokens based on elapsed time
  const elapsedMs = now - bucket.lastRefill;
  const refillTokens = (elapsedMs / 1000) * config.refillRate;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + refillTokens);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), resetMs: 0 };
  }

  // Not enough tokens — compute time until one token is available
  const deficit = 1 - bucket.tokens;
  const resetMs = Math.ceil((deficit / config.refillRate) * 1000);
  return { allowed: false, remaining: 0, resetMs };
}

// ---------------------------------------------------------------------------
// Convenience: returns a 429 Response if rate-limited, otherwise null.
// ---------------------------------------------------------------------------

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Response | null {
  const result = rateLimit(identifier, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  return null;
}
