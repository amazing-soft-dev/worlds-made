import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors';

/**
 * Sliding-window limiter held in memory. It is per server instance: on serverless each warm instance counts
 * separately, so these are guard rails against bursts and abuse, not exact quotas. Quotas that must be exact
 * (daily builds, publishes, likes) are enforced from the database instead.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Records a hit. Returns whether it is allowed and, if not, how long to wait. */
  hit(key: string, limit: number, windowMs: number, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Drops idle keys so the map cannot grow without bound. */
  sweep(windowMs: number, now: number = Date.now()): void {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
  }
}

/** Throws 429 with a Retry-After header when `key` has had `limit` hits in `windowMs`. */
export function enforce(limiter: RateLimiter, reply: FastifyReply, key: string, limit: number, windowMs: number, message?: string): void {
  const r = limiter.hit(key, limit, windowMs);
  if (!r.allowed) {
    reply.header('retry-after', String(r.retryAfterSec));
    throw new AppError(429, 'rate_limited', message ?? 'Too many requests, try again later', { retryAfterSec: r.retryAfterSec });
  }
}

export const clientIp = (req: FastifyRequest): string => req.ip;
