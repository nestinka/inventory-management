import { LRUCache } from 'lru-cache';
import { ApiError } from './errors';

type RateLimitEntry = { count: number; resetAt: number };

const cache = new LRUCache<string, RateLimitEntry>({ max: 10_000, ttl: 60_000 });

export function rateLimit(key: string, maxPerMinute: number): void {
  const now = Date.now();
  const entry = cache.get(key);

  if (!entry || now > entry.resetAt) {
    cache.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (entry.count >= maxPerMinute) {
    throw new ApiError('RATE_LIMITED', 429, `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`);
  }

  entry.count += 1;
}
