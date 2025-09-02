import { useQuery } from "@tanstack/react-query";
import type { MiningCoinData } from "@shared/api";

export function useMiningCoin(slug: string | undefined) {
  return useQuery<MiningCoinData, Error>({
    queryKey: ["mining-coin", slug],
    queryFn: async () => {
      const res = await fetch(`/api/mining/coin/${encodeURIComponent(slug || "")}`);
      if (!res.ok) {
        let details: any = undefined;
        try { details = await res.json(); } catch { /* ignore */ }
        const message = typeof details?.error === "string" ? details.error : `Failed to fetch mining data (${res.status})`;
        throw new Error(message);
      }
      return (await res.json()) as MiningCoinData;
    },
    enabled: Boolean(slug && slug.length > 0),
    refetchInterval: 60_000, // 60s
    retry: 1,
  });
}
