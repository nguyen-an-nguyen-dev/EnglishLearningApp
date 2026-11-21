import type { Request, RequestHandler } from 'express';
import { HttpError } from './error-handler';

/**
 * Minimal in-memory sliding-window rate limiter. State resets on restart, which
 * is fine for a single instance; multi-instance setups need a shared store.
 * Bypassed when NODE_ENV=test or AUTH_RATE_LIMIT=off so the integration suite
 * (many login/register calls from one loopback IP) never trips it.
 */

const disabled = process.env.NODE_ENV === 'test' || process.env.AUTH_RATE_LIMIT === 'off';

const buckets = new Map<string, number[]>();

function prune(key: string, windowMs: number, now: number): number {
  const hits = buckets.get(key);
  if (!hits) return 0;
  const cutoff = now - windowMs;
  const kept = hits.filter((t) => t > cutoff);
  if (kept.length === 0) buckets.delete(key);
  else buckets.set(key, kept);
  return kept.length;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message?: string;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  if (disabled) {
    return (_req, _response, next) => next();
  }
  return (req, _response, next) => {
    const now = Date.now();
    const key = options.key(req);
    const used = prune(key, options.windowMs, now);
    if (used >= options.max) {
      next(new HttpError(429, options.message ?? 'Too many requests. Try again later.'));
      return;
    }
    const hits = buckets.get(key) ?? [];
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** Every 10 minutes drop stale buckets (keeps memory flat under abuse). */
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const kept = hits.filter((t) => now - t < 60 * 60 * 1000);
    if (kept.length === 0) buckets.delete(key);
    else buckets.set(key, kept);
  }
}, 10 * 60 * 1000);
sweeper.unref();
