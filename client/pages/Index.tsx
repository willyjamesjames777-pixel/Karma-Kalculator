import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useCoinMarkets } from "@/hooks/useCoinMarkets";
import { useMiningCoin } from "@/hooks/useMiningCoin";
import type { CoinMarket, MiningCoinData } from "@shared/api";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Plus, Trash2 } from "lucide-react";

interface TrackedCoin {
  id: string; // CoinGecko id (e.g., bitcoin)
  mpsSlug: string; // MiningPoolStats slug (e.g., bitcoin)
  myHashrate: number; // in H/s
  pool?: string; // pool name or URL
  coinsMined?: number; // lifetime or period you choose
}

const LS_KEY = "hashtrack.coins.v1";

function formatHashrate(value: number | undefined) {
  if (!value || value <= 0) return "-";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"] as const;
  let idx = 0;
  let v = value;
  while (v >= 1000 && idx < units.length - 1) {
    v /= 1000;
    idx++;
  }
  return `${v.toFixed(2)} ${units[idx]}`;
}

function formatCurrency(n?: number) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(n);
}

function PriceCell({ m }: { m?: CoinMarket }) {
  if (!m) return <span>-</span>;
  const pc24 = m.price_change_percentage_24h_in_currency ?? 0;
  const up = pc24 >= 0;
  return (
    <div className="flex items-center gap-2">
      <img src={m.image} alt={m.name} className="w-5 h-5 rounded-sm" />
      <div className="flex flex-col">
        <span className="font-medium">{formatCurrency(m.current_price)}</span>
        <span className={cn("text-xs flex items-center gap-1", up ? "text-emerald-500" : "text-red-500")}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {Math.abs(pc24).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function useMining(slug?: string) {
  const { data } = useMiningCoin(slug);
  const networkHashrate = (data as any)?.network_hashrate || (data as any)?.hash || (data as any)?.nethash || undefined;
  // Try to get pool list consistently
  const pools: MiningCoinData["pools"] | undefined = (data as any)?.pools || (data as any)?.pool || undefined;
  return { data, networkHashrate: typeof networkHashrate === "number" ? networkHashrate : undefined, pools };
}

export default function Index() {
  const [coins, setCoins] = useState<TrackedCoin[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as TrackedCoin[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newCoin, setNewCoin] = useState<TrackedCoin>({ id: "", mpsSlug: "", myHashrate: 0, pool: "" });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(coins));
  }, [coins]);

  const ids = useMemo(() => coins.map((c) => c.id).filter(Boolean), [coins]);
  const { data: markets, refetch, isFetching } = useCoinMarkets(ids, "usd");

  const marketsById = useMemo(() => {
    const map = new Map<string, CoinMarket>();
    markets?.forEach((m) => map.set(m.id, m));
    return map;
  }, [markets]);

  const addCoin = () => {
    if (!newCoin.id || !newCoin.mpsSlug) return;
    setCoins((prev) => [...prev, { ...newCoin }]);
    setNewCoin({ id: "", mpsSlug: "", myHashrate: 0, pool: "" });
  };

  const removeCoin = (idx: number) => setCoins((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,theme(colors.primary.DEFAULT)/12%,transparent),linear-gradient(to_bottom,#0b1020,#0b1020)] text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Mining Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">List new coins, compare your hashrate vs network/pool, and track live prices.</p>
          </div>
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="md:col-span-3 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Add Coin</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="cgid">CoinGecko ID</Label>
                <Input id="cgid" placeholder="e.g. bitcoin" value={newCoin.id} onChange={(e) => setNewCoin({ ...newCoin, id: e.target.value.trim() })} />
                <p className="text-[11px] text-muted-foreground mt-1">Find IDs at coingecko.com (coin page URL slug).</p>
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="mps">MiningPoolStats Slug</Label>
                <Input id="mps" placeholder="e.g. bitcoin" value={newCoin.mpsSlug} onChange={(e) => setNewCoin({ ...newCoin, mpsSlug: e.target.value.trim() })} />
                <p className="text-[11px] text-muted-foreground mt-1">From miningpoolstats.stream (coin page URL slug).</p>
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="hash">My Hashrate (H/s)</Label>
                <Input id="hash" type="number" min={0} value={newCoin.myHashrate} onChange={(e) => setNewCoin({ ...newCoin, myHashrate: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="pool">Pool</Label>
                <Input id="pool" placeholder="e.g. ViaBTC" value={newCoin.pool} onChange={(e) => setNewCoin({ ...newCoin, pool: e.target.value })} />
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button className="w-full" onClick={addCoin}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coin</TableHead>
                  <TableHead>Price (USD)</TableHead>
                  <TableHead className="text-right">Network Hashrate</TableHead>
                  <TableHead className="text-right">My Hashrate</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      Add your first coin above to start tracking live price and hashrate.
                    </TableCell>
                  </TableRow>
                )}
                {coins.map((c, idx) => (
                  <CoinRow
                    key={`${c.id}-${idx}`}
                    coin={c}
                    onChange={(next) => setCoins((prev) => prev.map((p, i) => (i === idx ? next : p)))}
                    onRemove={() => removeCoin(idx)}
                    market={marketsById.get(c.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoinRow({ coin, market, onChange, onRemove }: { coin: TrackedCoin; market?: CoinMarket; onChange: (c: TrackedCoin) => void; onRemove: () => void }) {
  const { networkHashrate, pools } = useMining(coin.mpsSlug);
  const share = useMemo(() => {
    if (!networkHashrate || !coin.myHashrate || coin.myHashrate <= 0) return undefined;
    return (coin.myHashrate / networkHashrate) * 100;
  }, [coin.myHashrate, networkHashrate]);

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="min-w-[180px]">
        <div className="flex items-center gap-3">
          {market ? (
            <img src={market.image} alt={market.name} className="w-7 h-7 rounded" />
          ) : (
            <div className="w-7 h-7 rounded bg-muted" />
          )}
          <div className="flex flex-col">
            <span className="font-medium">{market?.name || coin.id}</span>
            <span className="text-xs text-muted-foreground uppercase">{market?.symbol || coin.mpsSlug}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <PriceCell m={market} />
      </TableCell>
      <TableCell className="text-right">
        <div className="tabular-nums">{formatHashrate(networkHashrate)}</div>
      </TableCell>
      <TableCell className="text-right w-[160px]">
        <Input
          inputMode="decimal"
          type="number"
          min={0}
          className="text-right"
          value={coin.myHashrate || 0}
          onChange={(e) => onChange({ ...coin, myHashrate: Number(e.target.value) })}
        />
        <div className="text-[11px] text-muted-foreground mt-1 text-right">H/s</div>
      </TableCell>
      <TableCell className="text-right">
        {share == null ? "-" : (
          <span className="tabular-nums font-medium">{share.toFixed(6)}%</span>
        )}
      </TableCell>
      <TableCell className="min-w-[160px]">
        <Input value={coin.pool || ""} onChange={(e) => onChange({ ...coin, pool: e.target.value })} placeholder="Pool name or URL" />
        {pools && Array.isArray(pools) && pools.length > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1 truncate">Top pool: {pools[0]?.name || pools[0]?.url || "-"}</div>
        )}
      </TableCell>
      <TableCell className="text-right w-[140px]">
        <Input
          inputMode="decimal"
          type="number"
          min={0}
          className="text-right"
          value={coin.coinsMined || 0}
          onChange={(e) => onChange({ ...coin, coinsMined: Number(e.target.value) })}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
