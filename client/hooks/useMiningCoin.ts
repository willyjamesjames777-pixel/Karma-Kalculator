import { useQuery } from "@tanstack/react-query";
import type { MiningCoinData } from "@shared/api";

export function useMiningCoin(slug: string | undefined) {
  const enabled = Boolean(slug && slug.length > 0);
  return useQuery<MiningCoinData, Error>({
    queryKey: ["mining-coin", slug],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/mining/coin/${encodeURIComponent(slug || "")}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Failed mining data (${res.status})`);
        return (await res.json()) as MiningCoinData;
      } catch {
        return {} as MiningCoinData;
      }
    },
    enabled,
    refetchInterval: 60_000,
    retry: 2,
    staleTime: 30_000,
  });
}
