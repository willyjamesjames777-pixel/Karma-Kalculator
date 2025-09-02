type Entry<T> = { value: T; expiresAt: number };

const cache = new Map<string, Entry<any>>();

export function getCache<T>(key: string): T | undefined {
  const now = Date.now();
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < now) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getStale<T>(key: string): T | undefined {
  // Return cached value even if expired (best-effort), used as fallback on 429s
  const hit = cache.get(key);
  return hit?.value as T | undefined;
}

export function cacheKeyFrom(
  url: string,
  params?: Record<string, any>,
): string {
  const p = params ? JSON.stringify(params) : "";
  return `${url}::${p}`;
}
