import { RequestHandler } from "express";

// MiningPoolStats unofficial API endpoint pattern. This may change; handle failures gracefully.
// Example slug: monero, ethereum-classic, bitcoin, ravencoin, etc
// Endpoint observed: https://miningpoolstats.stream/api/coin/<slug>
const MPS_COIN_BASE = "https://miningpoolstats.stream/api/coin";

export const handleMiningCoin: RequestHandler = async (req, res) => {
  try {
    const slug = (req.params.slug as string)?.trim();
    if (!slug) return res.status(400).json({ error: "Missing coin slug" });

    const url = `${MPS_COIN_BASE}/${encodeURIComponent(slug)}`;
    const resp = await fetch(url, { headers: { accept: "application/json" } });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: "MiningPoolStats error", details: text });
    }

    const data = await resp.json();
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch MiningPoolStats coin data", details: err?.message ?? String(err) });
  }
};

// Some coins may be listed under algos; provide an optional algo listing endpoint if needed later.
