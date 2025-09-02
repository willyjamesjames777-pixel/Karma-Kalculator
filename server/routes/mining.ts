import { RequestHandler } from "express";
import { cacheKeyFrom, getCache, setCache, getStale } from "../utils/cache";
import { fetchWithRetry } from "../utils/fetchWithRetry";

// MiningPoolStats unofficial API endpoint pattern. This may change; handle failures gracefully.
// Example slug: monero, ethereum-classic, bitcoin, ravencoin, etc
// Endpoint observed: https://miningpoolstats.stream/api/coin/<slug>
const MPS_COIN_BASE = "https://miningpoolstats.stream/api/coin";

export const handleMiningCoin: RequestHandler = async (req, res) => {
  try {
    const slug = (req.params.slug as string)?.trim();
    if (!slug) return res.status(400).json({ error: "Missing coin slug" });

    const url = `${MPS_COIN_BASE}/${encodeURIComponent(slug)}`;
    const key = cacheKeyFrom("mps:coin", { slug });
    const cached = getCache<any>(key);
    if (cached) {
      res.setHeader("x-cache", "hit");
      return res.status(200).json(cached);
    }

    const resp = await fetchWithRetry(
      url,
      { headers: { accept: "application/json" } },
      { retries: 2, baseDelayMs: 700 },
    );

    if (!resp.ok) {
      // serve stale on 429/5xx
      if (resp.status === 429 || resp.status >= 500) {
        const stale = getStale<any>(key);
        if (stale) {
          res.setHeader("x-cache", "stale");
          return res.status(200).json(stale);
        }
      }
      const text = await resp.text();
      return res
        .status(resp.status)
        .json({ error: "MiningPoolStats error", details: text });
    }

    const data = await resp.json();
    setCache(key, data, 120_000); // 2 min TTL
    res.setHeader("cache-control", "public, max-age=120");
    res.status(200).json(data);
  } catch (err: any) {
    res
      .status(500)
      .json({
        error: "Failed to fetch MiningPoolStats coin data",
        details: err?.message ?? String(err),
      });
  }
};

// Some coins may be listed under algos; provide an optional algo listing endpoint if needed later.
