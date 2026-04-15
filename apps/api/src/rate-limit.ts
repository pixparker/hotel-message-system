import type { MiddlewareHandler } from "hono";
import { redis } from "./redis.js";
import { log } from "./log.js";

interface RateLimitOptions {
  /** Window in seconds */
  windowSec: number;
  /** Max requests within the window */
  max: number;
  /** Prefix for the Redis key (e.g. "rl:auth"). */
  prefix: string;
  /** Extract the rate-limit key per request (IP, org id, etc.). */
  keyFrom: (c: Parameters<MiddlewareHandler>[0]) => string | undefined;
}

/**
 * Fixed-window Redis-backed rate limiter.
 *
 * Uses INCR with a TTL on first write. Accurate enough for abuse protection;
 * not a precise sliding window. If Redis is unreachable we FAIL OPEN — a
 * missing limiter is better than a blocked API during a Redis outage.
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const id = opts.keyFrom(c);
    if (!id) {
      // No identifier → skip limiter (e.g. trusted health checks).
      return next();
    }
    const key = `${opts.prefix}:${id}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, opts.windowSec);
      }
      if (count > opts.max) {
        const ttl = await redis.ttl(key);
        c.header("Retry-After", String(ttl > 0 ? ttl : opts.windowSec));
        return c.json({ error: "rate_limited" }, 429);
      }
    } catch (err) {
      // Fail open; log so we notice.
      log.warn({ err, key }, "rate limiter error — failing open");
    }
    return next();
  };
}

/** Best-effort client IP (respects x-forwarded-for behind a proxy). */
export function clientIp(c: Parameters<MiddlewareHandler>[0]): string | undefined {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = c.req.header("x-real-ip");
  if (real) return real;
  // Fallback: use user-agent-ish identifier so tests still work locally.
  return c.req.header("cf-connecting-ip") ?? "anonymous";
}
