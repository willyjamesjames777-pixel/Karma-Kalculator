import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleCoinMarkets, handleSimplePrice } from "./routes/coingecko";
import { handleMiningCoin } from "./routes/mining";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // CoinGecko proxies
  app.get("/api/coingecko/markets", handleCoinMarkets);
  app.get("/api/coingecko/price", handleSimplePrice);

  // MiningPoolStats proxies
  app.get("/api/mining/coin/:slug", handleMiningCoin);

  return app;
}
