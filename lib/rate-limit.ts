// Best-effort, in-memory limiter. State is per server instance and resets on
// restart; it is not shared between serverless instances.
const hits = new Map<string, number[]>();

/**
 * Records a hit for `key` and returns true when it exceeds `limit` hits
 * within the last `windowMs` milliseconds. Blocked hits are not recorded.
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
