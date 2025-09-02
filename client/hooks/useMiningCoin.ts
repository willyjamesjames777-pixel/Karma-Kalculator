import { useQuery } from "@tanstack/react-query";
import type { MiningCoinData } from "@shared/api";

export function useMiningCoin(slug: string | undefined) {
  return useQuery<MiningCoinData, Error>({
    queryKey: ["mining-coin", slug],
    queryFn: async () => {
      const res = await fetch(`/api/mining/coin/${encodeURIComponent(slug || "")}`);
      if (!res.ok) throw new Error(`Failed to fetch mining data (${res.status})`);
      return (await res.json()) as MiningCoinData;
    },
    enabled: Boolean(slug && slug.length > 0),
    refetchInterval: 60_000, // 60s
  });
}
