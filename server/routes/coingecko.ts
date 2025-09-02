import { RequestHandler } from "express";
import { cacheKeyFrom, getCache, getStale, setCache } from "../utils/cache";
import { fetchWithRetry } from "../utils/fetchWithRetry";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Proxy to CoinGecko markets endpoint. Example: /api/coingecko/markets?ids=bitcoin,ethereum&vs_currency=usd
export const handleCoinMarkets: RequestHandler = async (req, res) => {
  try {
    const ids = (req.query.ids as string) || "";
    const vs_currency = ((req.query.vs_currency as string) || "usd").toLowerCase();
    const per_page = Math.min(Number(req.query.per_page ?? 250), 250);

    const url = new URL(`${COINGECKO_BASE}/coins/markets`);
    if (ids) url.searchParams.set("ids", ids);
    url.searchParams.set("vs_currency", vs_currency);
    url.searchParams.set("per_page", String(per_page));
    url.searchParams.set("page", String(req.query.page ?? 1));
    url.searchParams.set("sparkline", String(false));
    url.searchParams.set("price_change_percentage", "1h,24h,7d");

    const key = cacheKeyFrom("/coins/markets", Object.fromEntries(url.searchParams.entries()));
    const cached = getCache<any>(key);
    if (cached) {
      res.setHeader("x-cache", "hit");
      return res.status(200).json(cached);
    }

    const resp = await fetchWithRetry(url.toString(), { headers: { accept: "application/json" } }, { retries: 3, baseDelayMs: 700 });

    if (!resp.ok) {
      if (resp.status === 429) {
        const stale = getStale<any>(key);
        if (stale) {
          res.setHeader("x-cache", "stale");
          return res.status(200).json(stale);
        }
      }
      const text = await resp.text();
      return res.status(resp.status).json({ error: "CoinGecko error", details: text });
    }

    const data = await resp.json();
    setCache(key, data, 60_000); // 60s TTL
    res.setHeader("cache-control", "public, max-age=60");
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch CoinGecko markets", details: err?.message ?? String(err) });
  }
};

// Proxy to CoinGecko simple price for a quick lookup: /api/coingecko/price?ids=bitcoin,ethereum&vs_currencies=usd
export const handleSimplePrice: RequestHandler = async (req, res) => {
  try {
    const ids = (req.query.ids as string) || "";
    const vs_currencies = ((req.query.vs_currencies as string) || "usd").toLowerCase();

    const url = new URL(`${COINGECKO_BASE}/simple/price`);
    if (ids) url.searchParams.set("ids", ids);
    url.searchParams.set("vs_currencies", vs_currencies);
    url.searchParams.set("include_market_cap", String(true));
    url.searchParams.set("include_24hr_vol", String(true));
    url.searchParams.set("include_24hr_change", String(true));

    const key = cacheKeyFrom("/simple/price", Object.fromEntries(url.searchParams.entries()));
    const cached = getCache<any>(key);
    if (cached) {
      res.setHeader("x-cache", "hit");
      return res.status(200).json(cached);
    }

    const resp = await fetchWithRetry(url.toString(), { headers: { accept: "application/json" } }, { retries: 3, baseDelayMs: 700 });

    if (!resp.ok) {
      if (resp.status === 429) {
        const stale = getStale<any>(key);
        if (stale) {
          res.setHeader("x-cache", "stale");
          return res.status(200).json(stale);
        }
      }
      const text = await resp.text();
      return res.status(resp.status).json({ error: "CoinGecko error", details: text });
    }

    const data = await resp.json();
    setCache(key, data, 30_000); // 30s TTL
    res.setHeader("cache-control", "public, max-age=30");
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch CoinGecko price", details: err?.message ?? String(err) });
  }
};
