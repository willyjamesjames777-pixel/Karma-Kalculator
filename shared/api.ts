/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// CoinGecko /coins/markets item
export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  total_volume: number;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
}

// MiningPoolStats coin response (approximate; structure may vary by coin)
export interface MiningPool {
  name: string;
  url: string;
  hashrate?: number; // in H/s if provided
  miners?: number;
  pool_fee?: string | number;
}

export interface MiningCoinData {
  coin: string;
  symbol?: string;
  network_hashrate?: number; // H/s if provided
  pools?: MiningPool[];
  [key: string]: any; // Keep flexible as MPS is unofficial
}
