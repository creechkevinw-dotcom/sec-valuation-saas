const hourlyBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkHourlyRateLimit(key: string, limit: number) {
  const now = Date.now();
  const bucket = hourlyBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    hourlyBuckets.set(key, { count: 1, resetAt: now + 60 * 60_000 });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  hourlyBuckets.set(key, bucket);
  return true;
}
