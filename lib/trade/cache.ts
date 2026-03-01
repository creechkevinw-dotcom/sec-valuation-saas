type CacheRecord<T> = { expiresAt: number; value: T };

const memoryCache = new Map<string, CacheRecord<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const record = memoryCache.get(key);
  if (!record) {
    return null;
  }
  if (record.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return record.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}
