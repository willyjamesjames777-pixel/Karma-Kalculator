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
      try {
        const res = await fetch(`/api/coingecko/markets?${params.toString()}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Failed markets (${res.status})`);
        return (await res.json()) as CoinMarket[];
      } catch {
        return [] as CoinMarket[];
      }
    },
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    retry: 2,
    staleTime: 30_000,
  });
}
