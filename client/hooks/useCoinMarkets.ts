import { useQuery } from "@tanstack/react-query";
import type { CoinMarket } from "@shared/api";

export function useCoinMarkets(ids: string[], vsCurrency: string = "usd") {
  return useQuery<CoinMarket[], Error>({
    queryKey: ["markets", { ids: ids.join(","), vsCurrency }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ids.length) params.set("ids", ids.join(","));
      params.set("vs_currency", vsCurrency);
      const res = await fetch(`/api/coingecko/markets?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch markets (${res.status})`);
      return (await res.json()) as CoinMarket[];
    },
    enabled: ids.length > 0,
    refetchInterval: 60_000, // 60s
  });
}
