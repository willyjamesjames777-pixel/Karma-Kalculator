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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HashrateEditor } from "@/components/HashrateEditor";

type HashUnit = "H/s" | "kH/s" | "MH/s" | "GH/s" | "TH/s" | "PH/s" | "EH/s";
const UNIT_MULT: Record<HashUnit, number> = {
  "H/s": 1,
  "kH/s": 1e3,
  "MH/s": 1e6,
  "GH/s": 1e9,
  "TH/s": 1e12,
  "PH/s": 1e15,
  "EH/s": 1e18,
};

interface TrackedCoin {
  id: string; // CoinGecko id (e.g., bitcoin)
  mpsSlug: string; // MiningPoolStats slug (e.g., bitcoin)
  myHashrate: number; // stored in H/s
  pool?: string; // pool name or URL
  coinsMined?: number;
  minedDate?: string; // ISO date (yyyy-mm-dd)
  netHashOverrideHps?: number; // manual override for network hashrate
}

const LS_KEY = "hashtrack.coins.v1";

function formatHashrate(value: number | undefined) {
  if (!value || value <= 0) return "-";
  const units: HashUnit[] = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let idx = 0;
  let v = value;
  while (v >= 1000 && idx < units.length - 1) {
    v /= 1000;
    idx++;
  }
  return `${v.toFixed(2)} ${units[idx]}`;
}

function parseHashrateText(input: unknown): number | undefined {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return undefined;
  const m = input.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*(EH|PH|TH|GH|MH|kH|H)\/?s?/i);
  if (!m) return Number.isFinite(Number(input)) ? Number(input) : undefined;
  const value = parseFloat(m[1]);
  const unit = (m[2].toUpperCase() + "/s") as HashUnit;
  const mult = UNIT_MULT[unit] ?? 1;
  return value * mult;
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

function normalizeSlug(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    // CoinGecko: /en/coins/<slug>
    const cgIdx = parts.indexOf("coins");
    if (cgIdx >= 0 && parts[cgIdx + 1]) return parts[cgIdx + 1].toLowerCase();
    // MiningPoolStats: /<slug>
    if (parts.length >= 1) return parts[parts.length - 1].toLowerCase();
  } catch {
    // not a URL, assume slug
  }
  return input.trim().toLowerCase();
}

function deriveNetworkHashrate(data: any): number | undefined {
  const direct = parseHashrateText(
    data?.network_hashrate ?? data?.hash ?? data?.nethash ?? data?.nethashrate ?? data?.netHash
  );
  if (direct) return direct;
  const pools = data?.pools || data?.pool;
  if (Array.isArray(pools)) {
    let sum = 0;
    for (const p of pools) {
      const v = parseHashrateText(p?.hashrate ?? p?.hash ?? p?.hash_rate);
      if (typeof v === "number" && Number.isFinite(v)) sum += v;
    }
    return sum > 0 ? sum : undefined;
  }
  return undefined;
}

function useMining(slug?: string) {
  const { data, error } = useMiningCoin(slug);
  const networkHashrate = deriveNetworkHashrate(data);
  const pools: MiningCoinData["pools"] | undefined = (data as any)?.pools || (data as any)?.pool || undefined;
  return { data, error, networkHashrate, pools };
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
  const [newCoin, setNewCoin] = useState({
    id: "",
    mpsSlug: "",
    hashValue: 0,
    hashUnit: "H/s" as HashUnit,
    netHashValue: 0,
    netHashUnit: "H/s" as HashUnit,
    pool: "",
    coinsMined: 0,
    minedDate: "",
  });

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
    const id = normalizeSlug(newCoin.id);
    const mpsSlug = normalizeSlug(newCoin.mpsSlug);
    if (!id || !mpsSlug) return;
    const myHashrate = (Number(newCoin.hashValue) || 0) * (UNIT_MULT[newCoin.hashUnit]);
    const netHashOverrideHps = (Number(newCoin.netHashValue) || 0) * (UNIT_MULT[newCoin.netHashUnit]);
    const entry: TrackedCoin = {
      id,
      mpsSlug,
      myHashrate,
      netHashOverrideHps: netHashOverrideHps > 0 ? netHashOverrideHps : undefined,
      pool: newCoin.pool || undefined,
      coinsMined: Number(newCoin.coinsMined) || 0,
      minedDate: newCoin.minedDate || undefined,
    };
    setCoins((prev) => [...prev, entry]);
    setNewCoin({ id: "", mpsSlug: "", hashValue: 0, hashUnit: "H/s", netHashValue: 0, netHashUnit: "H/s", pool: "", coinsMined: 0, minedDate: "" });
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
                <Label htmlFor="cgid">CoinGecko ID or URL</Label>
                <Input id="cgid" placeholder="e.g. bitcoin or https://coingecko.com/coins/bitcoin" value={newCoin.id} onChange={(e) => setNewCoin({ ...newCoin, id: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Paste the coin page URL or slug.</p>
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="mps">MiningPoolStats Slug or URL</Label>
                <Input id="mps" placeholder="e.g. bitcoin or https://miningpoolstats.stream/bitcoin" value={newCoin.mpsSlug} onChange={(e) => setNewCoin({ ...newCoin, mpsSlug: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Paste the coin page URL or slug.</p>
              </div>
              <div className="md:col-span-3 grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <Label htmlFor="hash">My Hashrate</Label>
                  <Input id="hash" type="number" min={0} value={newCoin.hashValue} onChange={(e) => setNewCoin({ ...newCoin, hashValue: Number(e.target.value) })} />
                </div>
                <div className="col-span-5">
                  <Label>Unit</Label>
                  <Select value={newCoin.hashUnit} onValueChange={(v) => setNewCoin({ ...newCoin, hashUnit: v as HashUnit })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(UNIT_MULT).map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-4 grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <Label htmlFor="nethash">Network Hashrate (optional)</Label>
                  <Input id="nethash" type="number" min={0} value={newCoin.netHashValue} onChange={(e) => setNewCoin({ ...newCoin, netHashValue: Number(e.target.value) })} />
                </div>
                <div className="col-span-5">
                  <Label>Unit</Label>
                  <Select value={newCoin.netHashUnit} onValueChange={(v) => setNewCoin({ ...newCoin, netHashUnit: v as HashUnit })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(UNIT_MULT).map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="pool">Pool</Label>
                <Input id="pool" placeholder="e.g. ViaBTC" value={newCoin.pool} onChange={(e) => setNewCoin({ ...newCoin, pool: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="coins">Coins Mined</Label>
                <Input id="coins" type="number" min={0} step={0.00000001} value={newCoin.coinsMined} onChange={(e) => setNewCoin({ ...newCoin, coinsMined: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={newCoin.minedDate} onChange={(e) => setNewCoin({ ...newCoin, minedDate: e.target.value })} />
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
                  <TableHead className="text-right">Market Cap</TableHead>
                  <TableHead className="text-right">Network Hashrate</TableHead>
                  <TableHead className="text-right">My Hashrate</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
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
  const { networkHashrate, pools, error } = useMining(coin.mpsSlug);
  const effectiveNetHash = coin.netHashOverrideHps && coin.netHashOverrideHps > 0 ? coin.netHashOverrideHps : networkHashrate;
  const share = useMemo(() => {
    const denom = effectiveNetHash ?? 0;
    if (denom <= 0 || !coin.myHashrate || coin.myHashrate <= 0) return undefined;
    const pct = (coin.myHashrate / denom) * 100;
    if (!Number.isFinite(pct)) return undefined;
    return pct;
  }, [coin.myHashrate, effectiveNetHash]);

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
        <div className="tabular-nums">{market?.market_cap ? formatCurrency(market.market_cap) : "-"}</div>
      </TableCell>
      <TableCell className="text-right min-w-[280px]">
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-muted-foreground">Auto: {networkHashrate ? <span className="tabular-nums">{formatHashrate(networkHashrate)}</span> : <span>—</span>} {error ? <span className="ml-2">({error.message})</span> : null}</div>
          <div className="w-full max-w-[260px]"><HashrateEditor valueHps={coin.netHashOverrideHps || 0} onChangeHps={(hps) => onChange({ ...coin, netHashOverrideHps: hps })} /></div>
        </div>
      </TableCell>
      <TableCell className="text-right w-[260px]">
        <HashrateEditor valueHps={coin.myHashrate || 0} onChangeHps={(hps) => onChange({ ...coin, myHashrate: hps })} />
      </TableCell>
      <TableCell className="text-right">
        {share == null ? "-" : (
          <span className="tabular-nums font-medium">{(share < 0.000001 ? 0 : share).toFixed(6)}%</span>
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
      <TableCell className="text-right w-[160px]">
        <Input type="date" value={coin.minedDate || ""} onChange={(e) => onChange({ ...coin, minedDate: e.target.value })} />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
