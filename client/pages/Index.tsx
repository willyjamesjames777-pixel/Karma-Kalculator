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

type CalcRow = {
  enabled: boolean;
  coin: string;
  coinId: string; // CoinGecko id
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

function useCalcState() {
  const [rows, setRows] = useState<CalcRow[]>(() => {
    try {
      const raw = localStorage.getItem(CALC_LS);
      if (raw) return JSON.parse(raw) as CalcRow[];
    } catch {}
    return [
      { enabled: true, coin: "Bitcoin", coinId: "bitcoin", yourVal: 100, yourUnit: "TH/s", powerWatts: 3000, elecPerKwh: 0.1, netVal: 600, netUnit: "EH/s", blockReward: 3.125, blockTimeSec: 600, poolFeePct: 1.0, notes: "BTC example" },
      { enabled: true, coin: "Kaspa", coinId: "kaspa", yourVal: 1, yourUnit: "GH/s", powerWatts: 350, elecPerKwh: 0.1, netVal: 140, netUnit: "TH/s", blockReward: 142, blockTimeSec: 1, poolFeePct: 1.0, notes: "KAS example" },
      { enabled: false, coin: "Ethereum Classic", coinId: "ethereum-classic", yourVal: 1, yourUnit: "GH/s", powerWatts: 800, elecPerKwh: 0.1, netVal: 120, netUnit: "TH/s", blockReward: 2.56, blockTimeSec: 13, poolFeePct: 1.0, notes: "ETC example" },
      { enabled: false, coin: "Monero", coinId: "monero", yourVal: 10, yourUnit: "kH/s", powerWatts: 200, elecPerKwh: 0.1, netVal: 2, netUnit: "GH/s", blockReward: 0.6, blockTimeSec: 120, poolFeePct: 1.0, notes: "XMR example" },
    ];
  });
  useEffect(() => localStorage.setItem(CALC_LS, JSON.stringify(rows)), [rows]);
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
