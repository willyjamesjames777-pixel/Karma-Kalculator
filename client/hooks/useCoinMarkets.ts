import { useQuery } from "@tanstack/react-query";
import type { CoinMarket } from "@shared/api";

export function useCoinMarkets(ids: string[], vsCurrency: string = "usd") {
  return useQuery<CoinMarket[], Error>({
    queryKey: ["markets", { ids: ids.join(","), vsCurrency }],
    queryFn: async () => {
      const params = new URLSearchParams();
      const cleanIds = ids.map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (cleanIds.length) params.set("ids", cleanIds.join(","));
      params.set("vs_currency", vsCurrency);
      const proxyUrl = `/api/coingecko/markets?${params.toString()}`;
      const directUrl = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}&per_page=250&page=1&sparkline=false&price_change_percentage=1h,24h,7d`;
      try {
        const res = await fetch(proxyUrl, { credentials: "same-origin" });
        if (res.ok) return (await res.json()) as CoinMarket[];
      } catch {
        // fall through to direct
      }
      try {
        const res2 = await fetch(directUrl, {
          headers: { accept: "application/json" },
        });
        if (res2.ok) return (await res2.json()) as CoinMarket[];
      } catch {
        // ignore
      }
      return [] as CoinMarket[];
    },
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });
}
