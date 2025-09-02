export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  {
    retries = 2,
    baseDelayMs = 500,
  }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    const res = await fetch(url, init).catch((e) => {
      lastErr = e;
      return undefined as any;
    });

    if (res && res.ok) return res;

    const status = res?.status;
    // If 429 or 5xx, backoff and retry
    if (status === 429 || (status && status >= 500)) {
      const retryAfter = res?.headers?.get("retry-after");
      const delayMs = retryAfter
        ? Number(retryAfter) * 1000
        : Math.pow(2, attempt) * baseDelayMs;
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
      continue;
    }

    if (res) return res; // non-retryable

    // network error
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * baseDelayMs));
    attempt++;
  }
  if (lastErr) throw lastErr;
  // Fallback
  return await fetch(url, init);
}
