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
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HashrateEditor } from "@/components/HashrateEditor";
import { Switch } from "@/components/ui/switch";

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
  id: string;
  mpsSlug: string;
  myHashrate: number;
  pool?: string;
  coinsMined?: number;
  minedDate?: string;
  netHashOverrideHps?: number;
}

const LS_KEY = "hashtrack.coins.v1";

function formatHashrate(value: number | undefined) {
  if (!value || value <= 0) return "-";
  const units: HashUnit[] = [
    "H/s",
    "kH/s",
    "MH/s",
    "GH/s",
    "TH/s",
    "PH/s",
    "EH/s",
  ];
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
  const m = input
    .trim()
    .match(/([0-9]+(?:\.[0-9]+)?)\s*(EH|PH|TH|GH|MH|kH|H)\/?s?/i);
  if (!m) return Number.isFinite(Number(input)) ? Number(input) : undefined;
  const value = parseFloat(m[1]);
  const unit = (m[2].toUpperCase() + "/s") as HashUnit;
  const mult = UNIT_MULT[unit] ?? 1;
  return value * mult;
}

function formatCurrency(n?: number) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(n);
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
        <span
          className={cn(
            "text-xs flex items-center gap-1",
            up ? "text-emerald-500" : "text-red-500",
          )}
        >
          {up ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}{" "}
          {Math.abs(pc24).toFixed(2)}%
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
    const cgIdx = parts.indexOf("coins");
    if (cgIdx >= 0 && parts[cgIdx + 1]) return parts[cgIdx + 1].toLowerCase();
    if (parts.length >= 1) return parts[parts.length - 1].toLowerCase();
  } catch {}
  return input.trim().toLowerCase();
}

function deriveNetworkHashrate(data: any): number | undefined {
  const direct = parseHashrateText(
    data?.network_hashrate ?? data?.hash ?? data?.nethash ?? data?.nethashrate ?? data?.netHash,
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
  const pools: MiningCoinData["pools"] | undefined =
    (data as any)?.pools || (data as any)?.pool || undefined;
  return { data, error, networkHashrate, pools };
}

function shareExplanation(
  myHps?: number,
  netHps?: number,
  pct?: number,
) {
  if (!myHps || !netHps || !pct) return "Share = My / Network × 100";
  const my = formatHashrate(myHps);
  const net = formatHashrate(netHps);
  const ratio = myHps / netHps;
  return `Share = My / Network × 100 = ${my} / ${net} = ${ratio.toPrecision(
    3,
  )} × 100 = ${pct.toFixed(6)}%`;
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

  async function exportXlsx(
    rows: TrackedCoin[],
    marketMap: Map<string, CoinMarket>,
  ) {
    const XLSX = await import("xlsx");
    const data = rows.map((c) => {
      const m = marketMap.get(c.id);
      const net = c.netHashOverrideHps ?? undefined;
      const my = c.myHashrate ?? undefined;
      const share = net && my ? (my / net) * 100 : undefined;
      return {
        id: c.id,
        mpsSlug: c.mpsSlug,
        coin: m?.name || c.id,
        symbol: m?.symbol || "",
        price_usd: m?.current_price ?? null,
        market_cap_usd: m?.market_cap ?? null,
        network_hashrate_hps: net ?? null,
        my_hashrate_hps: my ?? null,
        share_percent: share == null ? null : Number(share.toFixed(6)),
        pool: c.pool || "",
        coins_mined: c.coinsMined ?? null,
        date: c.minedDate || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fname = `portfolio-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(
      ts.getDate(),
    )}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(
      ts.getSeconds(),
    )}.xlsx`;
    if ((XLSX as any).writeFileXLSX) {
      (XLSX as any).writeFileXLSX(wb, fname);
    } else {
      (XLSX as any).writeFile(wb, fname, { bookType: "xlsx" });
    }
  }

  const addCoin = () => {
    const id = normalizeSlug(newCoin.id);
    const slugInput = normalizeSlug(newCoin.mpsSlug);
    if (!id) return;
    const myHashrate = (Number(newCoin.hashValue) || 0) * UNIT_MULT[newCoin.hashUnit];
    const netHashOverrideHps =
      (Number(newCoin.netHashValue) || 0) * UNIT_MULT[newCoin.netHashUnit];
    const entry: TrackedCoin = {
      id,
      mpsSlug: slugInput || id,
      myHashrate,
      netHashOverrideHps: netHashOverrideHps > 0 ? netHashOverrideHps : undefined,
      pool: newCoin.pool || undefined,
      coinsMined: Number(newCoin.coinsMined) || 0,
      minedDate: newCoin.minedDate || undefined,
    };
    setCoins((prev) => [...prev, entry]);

    // Also add a row to the profitability calculator
    const calcRow: CalcRow = {
      enabled: true,
      coin: id,
      coinId: id,
      yourVal: Number(newCoin.hashValue) || 0,
      yourUnit: newCoin.hashUnit,
      powerWatts: 0,
      elecPerKwh: 0.1,
      netVal: Number(newCoin.netHashValue) || 0,
      netUnit: newCoin.netHashUnit,
      blockReward: 0,
      blockTimeSec: 0,
      poolFeePct: 0,
      notes: newCoin.pool || "",
    };
    window.dispatchEvent(
      new CustomEvent<CalcRow>("hashtrack-calc-add", { detail: calcRow }),
    );

    setNewCoin({
      id: "",
      mpsSlug: "",
      hashValue: 0,
      hashUnit: "H/s",
      netHashValue: 0,
      netHashUnit: "H/s",
      pool: "",
      coinsMined: 0,
      minedDate: "",
    });
  };

  const removeCoin = (idx: number) =>
    setCoins((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,theme(colors.primary.DEFAULT)/12%,transparent),linear-gradient(to_bottom,#0b1020,#0b1020)] text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Mining Tracker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              List new coins, compare your hashrate vs network/pool, and track live prices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportXlsx(coins, marketsById)}
              className="gap-2"
            >
              Download XLSX
            </Button>
            <Button
              variant="secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="md:col-span-3 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Add Coin</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="cgid">CoinGecko ID or URL</Label>
                <Input
                  id="cgid"
                  placeholder="e.g. bitcoin or https://coingecko.com/coins/bitcoin"
                  value={newCoin.id}
                  onChange={(e) => setNewCoin({ ...newCoin, id: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Paste the coin page URL or slug.
                </p>
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="mps">MiningPoolStats Slug or URL</Label>
                <Input
                  id="mps"
                  placeholder="e.g. bitcoin or https://miningpoolstats.stream/bitcoin"
                  value={newCoin.mpsSlug}
                  onChange={(e) => setNewCoin({ ...newCoin, mpsSlug: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Paste the coin page URL or slug.
                </p>
              </div>
              <div className="md:col-span-3 grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <Label htmlFor="hash">My Hashrate</Label>
                  <Input
                    id="hash"
                    type="number"
                    min={0}
                    value={newCoin.hashValue}
                    onChange={(e) =>
                      setNewCoin({ ...newCoin, hashValue: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-5">
                  <Label>Unit</Label>
                  <Select
                    value={newCoin.hashUnit}
                    onValueChange={(v) => setNewCoin({ ...newCoin, hashUnit: v as HashUnit })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(UNIT_MULT).map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-4 grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <Label htmlFor="nethash">Network Hashrate (optional)</Label>
                  <Input
                    id="nethash"
                    type="number"
                    min={0}
                    value={newCoin.netHashValue}
                    onChange={(e) =>
                      setNewCoin({ ...newCoin, netHashValue: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-5">
                  <Label>Unit</Label>
                  <Select
                    value={newCoin.netHashUnit}
                    onValueChange={(v) => setNewCoin({ ...newCoin, netHashUnit: v as HashUnit })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(UNIT_MULT).map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="pool">Pool</Label>
                <Input
                  id="pool"
                  placeholder="e.g. ViaBTC"
                  value={newCoin.pool}
                  onChange={(e) => setNewCoin({ ...newCoin, pool: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="coins">Coins Mined</Label>
                <Input
                  id="coins"
                  type="number"
                  min={0}
                  step={0.00000001}
                  value={newCoin.coinsMined}
                  onChange={(e) =>
                    setNewCoin({ ...newCoin, coinsMined: Number(e.target.value) })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newCoin.minedDate}
                  onChange={(e) => setNewCoin({ ...newCoin, minedDate: e.target.value })}
                />
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

        <ProfitCalculator />
      </div>
    </div>
  );
}

function CoinRow({
  coin,
  market,
  onChange,
  onRemove,
}: {
  coin: TrackedCoin;
  market?: CoinMarket;
  onChange: (c: TrackedCoin) => void;
  onRemove: () => void;
}) {
  const { networkHashrate, pools, error } = useMining(coin.mpsSlug);
  const effectiveNetHash =
    coin.netHashOverrideHps && coin.netHashOverrideHps > 0
      ? coin.netHashOverrideHps
      : networkHashrate;
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
            <span className="text-xs text-muted-foreground uppercase">
              {market?.symbol || coin.mpsSlug}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <PriceCell m={market} />
      </TableCell>
      <TableCell className="text-right">
        <div className="tabular-nums">
          {market?.market_cap ? formatCurrency(market.market_cap) : "-"}
        </div>
      </TableCell>
      <TableCell className="text-right min-w-[360px]">
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-muted-foreground">
            Auto:{" "}
            {networkHashrate ? (
              <span className="tabular-nums">{formatHashrate(networkHashrate)}</span>
            ) : (
              <span>—</span>
            )}{" "}
            {error ? <span className="ml-2">({error.message})</span> : null}
          </div>
          <div className="w-full max-w-[320px]">
            <HashrateEditor
              valueHps={coin.netHashOverrideHps || 0}
              onChangeHps={(hps) => onChange({ ...coin, netHashOverrideHps: hps })}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right min-w-[360px] w-[380px]">
        <HashrateEditor
          valueHps={coin.myHashrate || 0}
          onChangeHps={(hps) => onChange({ ...coin, myHashrate: hps })}
        />
      </TableCell>
      <TableCell className="text-right">
        {share == null ? (
          "-"
        ) : (
          <Tooltip>
            <TooltipTrigger className="tabular-nums font-medium underline decoration-dotted underline-offset-4">
              {(share < 0.000001 ? 0 : share).toFixed(6)}%
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs text-xs">
                {shareExplanation(coin.myHashrate, effectiveNetHash, share)}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
      <TableCell className="min-w-[160px]">
        <Input
          value={coin.pool || ""}
          onChange={(e) => onChange({ ...coin, pool: e.target.value })}
          placeholder="Pool name or URL"
        />
        {pools && Array.isArray(pools) && pools.length > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Top pool: {pools[0]?.name || pools[0]?.url || "-"}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right min-w-[220px] w-[240px]">
        <Input
          inputMode="decimal"
          type="number"
          min={0}
          className="text-right tabular-nums"
          value={coin.coinsMined || 0}
          onChange={(e) => onChange({ ...coin, coinsMined: Number(e.target.value) })}
        />
      </TableCell>
      <TableCell className="text-right w-[160px]">
        <Input
          type="date"
          value={coin.minedDate || ""}
          onChange={(e) => onChange({ ...coin, minedDate: e.target.value })}
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

type CalcRow = {
  enabled: boolean;
  coin: string;
  coinId: string;
  yourVal: number;
  yourUnit: HashUnit;
  powerWatts: number;
  elecPerKwh: number;
  netVal: number;
  netUnit: HashUnit;
  blockReward: number;
  blockTimeSec: number;
  poolFeePct: number;
  notes?: string;
};

const CALC_LS = "hashtrack.calc.v1";

function toHps(value: number, unit: HashUnit) {
  return (Number(value) || 0) * UNIT_MULT[unit];
}

function blocksPerDay(myHps: number, netHps: number, blockTime: number, poolFeePct: number) {
  if (!myHps || !netHps || !blockTime) return 0;
  const networkBlocksPerDay = 86400 / blockTime;
  const share = myHps / netHps;
  const afterFee = Math.max(0, 1 - (Number(poolFeePct) || 0) / 100);
  return share * networkBlocksPerDay * afterFee;
}

function dailyPowerCostUSD(powerWatts: number, elecPerKwh: number) {
  return ((Number(powerWatts) || 0) / 1000) * 24 * (Number(elecPerKwh) || 0);
}

function useCalcState() {
  const [rows, setRows] = useState<CalcRow[]>(() => {
    try {
      const raw = localStorage.getItem(CALC_LS);
      if (raw) {
        const parsed = JSON.parse(raw) as CalcRow[];
        const sampleIds = new Set(["bitcoin", "kaspa", "ethereum-classic", "monero"]);
        const onlySamples = parsed.length > 0 && parsed.every(r => sampleIds.has(r.coinId));
        return onlySamples ? [] : parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => localStorage.setItem(CALC_LS, JSON.stringify(rows)), [rows]);

  useEffect(() => {
    function onAdd(e: Event) {
      const ev = e as CustomEvent<CalcRow>;
      const detail = ev.detail;
      if (!detail) return;
      setRows((prev) => [...prev, detail]);
    }
    window.addEventListener("hashtrack-calc-add", onAdd as any);
    return () => window.removeEventListener("hashtrack-calc-add", onAdd as any);
  }, []);

  return { rows, setRows } as const;
}

function ProfitCalculator() {
  const { rows, setRows } = useCalcState();
  const ids = useMemo(() => rows.filter(r => r.enabled).map(r => r.coinId).filter(Boolean), [rows]);
  const { data: prices } = useCoinMarkets(ids, "usd");
  const priceMap = useMemo(() => {
    const m = new Map<string, CoinMarket>();
    prices?.forEach(p => m.set(p.id, p));
    return m;
  }, [prices]);

  const enabledRows = rows.filter(r => r.enabled);
  const profits = enabledRows.map(r => {
    const my = toHps(r.yourVal, r.yourUnit);
    const net = toHps(r.netVal, r.netUnit);
    const bpd = blocksPerDay(my, net, r.blockTimeSec, r.poolFeePct);
    const price = priceMap.get(r.coinId)?.current_price || 0;
    const revenue = bpd * r.blockReward * price;
    const power = dailyPowerCostUSD(r.powerWatts, r.elecPerKwh);
    return revenue - power;
  });
  const ranks = new Map<number, number>();
  const sorted = [...profits].sort((a, b) => b - a);
  profits.forEach((p, i) => { ranks.set(i, sorted.indexOf(p) + 1); });

  const addRow = () => setRows(prev => [...prev, { enabled: true, coin: "", coinId: "", yourVal: 0, yourUnit: "H/s", powerWatts: 0, elecPerKwh: 0.1, netVal: 0, netUnit: "H/s", blockReward: 0, blockTimeSec: 0, poolFeePct: 0, notes: "" }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  return (
    <Card className="mt-12 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Profitability Calculator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-xs text-muted-foreground">Live price from CoinGecko. Enter hashrates, network, rewards, power and costs; rows with Enabled=1 are ranked by daily profit.</div>
        <div className="flex justify-end mb-3"><Button onClick={addRow}>Add Row</Button></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>On</TableHead>
              <TableHead>Coin</TableHead>
              <TableHead>CoinGecko ID</TableHead>
              <TableHead className="text-right">Your Hashrate</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Power (W)</TableHead>
              <TableHead className="text-right">$/kWh</TableHead>
              <TableHead className="text-right">Network Hashrate</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Block Reward</TableHead>
              <TableHead className="text-right">Block Time (s)</TableHead>
              <TableHead className="text-right">Pool Fee %</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Blocks/Day</TableHead>
              <TableHead className="text-right">Revenue/Day</TableHead>
              <TableHead className="text-right">Power/Day</TableHead>
              <TableHead className="text-right">Profit/Day</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => {
              const my = toHps(r.yourVal, r.yourUnit);
              const net = toHps(r.netVal, r.netUnit);
              const bpd = blocksPerDay(my, net, r.blockTimeSec, r.poolFeePct);
              const price = priceMap.get(r.coinId)?.current_price || 0;
              const revenue = bpd * r.blockReward * price;
              const power = dailyPowerCostUSD(r.powerWatts, r.elecPerKwh);
              const profit = revenue - power;
              const rank = r.enabled ? (ranks.get(enabledRows.indexOf(r)) || "") : "";
              return (
                <TableRow key={idx} className="hover:bg-muted/30">
                  <TableCell><Switch checked={r.enabled} onCheckedChange={(v) => setRows(prev => prev.map((p,i)=> i===idx? { ...p, enabled: Boolean(v)}:p))} /></TableCell>
                  <TableCell className="min-w-[160px]"><Input value={r.coin} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, coin: e.target.value }:p))} placeholder="Coin name" /></TableCell>
                  <TableCell className="min-w-[160px]"><Input value={r.coinId} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, coinId: e.target.value.trim().toLowerCase() }:p))} placeholder="coingecko id" /></TableCell>
                  <TableCell className="text-right min-w-[140px]"><Input type="number" inputMode="decimal" value={r.yourVal} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, yourVal: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="min-w-[120px]">
                    <Select value={r.yourUnit} onValueChange={(v)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, yourUnit: v as HashUnit }:p))}>
                      <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(UNIT_MULT) as HashUnit[]).map(u=> <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right min-w-[120px]"><Input type="number" inputMode="decimal" value={r.powerWatts} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, powerWatts: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="text-right min-w-[120px]"><Input type="number" inputMode="decimal" value={r.elecPerKwh} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, elecPerKwh: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="text-right min-w-[140px]"><Input type="number" inputMode="decimal" value={r.netVal} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, netVal: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="min-w-[120px]">
                    <Select value={r.netUnit} onValueChange={(v)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, netUnit: v as HashUnit }:p))}>
                      <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(UNIT_MULT) as HashUnit[]).map(u=> <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right min-w-[120px]"><Input type="number" inputMode="decimal" value={r.blockReward} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, blockReward: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="text-right min-w-[120px]"><Input type="number" inputMode="decimal" value={r.blockTimeSec} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, blockTimeSec: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="text-right min-w-[120px]"><Input type="number" inputMode="decimal" value={r.poolFeePct} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, poolFeePct: Number(e.target.value) }:p))} className="text-right" /></TableCell>
                  <TableCell className="min-w-[160px]"><Input value={r.notes || ""} onChange={(e)=> setRows(prev=> prev.map((p,i)=> i===idx? { ...p, notes: e.target.value }:p))} placeholder="notes" /></TableCell>
                  <TableCell className="text-right tabular-nums">{priceMap.get(r.coinId)?.current_price != null ? formatCurrency(priceMap.get(r.coinId)!.current_price) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{bpd ? bpd.toFixed(6) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{revenue ? formatCurrency(revenue) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{power ? formatCurrency(power) : "$0.00"}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{Number.isFinite(profit) ? formatCurrency(profit) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{rank}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=> removeRow(idx)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
