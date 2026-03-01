const minuteBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 5) {
  const now = Date.now();
  const bucket = minuteBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    minuteBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  minuteBuckets.set(key, bucket);
  return true;
}
