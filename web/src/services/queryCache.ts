interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry<unknown>>();

/** In-memory TTL cache for low-churn public data. Never cache user-specific data here. */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await loader();
  entries.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateQueryCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    entries.clear();
    return;
  }
  for (const key of entries.keys()) {
    if (key.startsWith(keyPrefix)) entries.delete(key);
  }
}
