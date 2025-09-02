import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type HashUnit = "H/s" | "kH/s" | "MH/s" | "GH/s" | "TH/s" | "PH/s" | "EH/s";
const UNIT_MULT: Record<HashUnit, number> = {
  "H/s": 1,
  "kH/s": 1e3,
  "MH/s": 1e6,
  "GH/s": 1e9,
  "TH/s": 1e12,
  "PH/s": 1e15,
  "EH/s": 1e18,
};

function suggestUnit(hps: number): HashUnit {
  const order: HashUnit[] = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let unit: HashUnit = "H/s";
  for (let i = 0; i < order.length; i++) {
    const u = order[i];
    if (hps / UNIT_MULT[u] < 1000) { unit = u; break; }
    unit = u;
  }
  return unit;
}

export function HashrateEditor({ valueHps, onChangeHps }: { valueHps: number; onChangeHps: (hps: number) => void }) {
  const [unit, setUnit] = useState<HashUnit>(() => suggestUnit(valueHps));
  const displayValue = useMemo(() => (valueHps ? valueHps / UNIT_MULT[unit] : 0), [valueHps, unit]);
  return (
    <div className="grid grid-cols-12 gap-2">
      <Input
        inputMode="decimal"
        type="number"
        min={0}
        className="col-span-8 text-right"
        value={Number.isFinite(displayValue) ? Number(displayValue) : 0}
        onChange={(e) => onChangeHps((Number(e.target.value) || 0) * UNIT_MULT[unit])}
      />
      <div className="col-span-4">
        <Select value={unit} onValueChange={(v) => setUnit(v as HashUnit)}>
          <SelectTrigger>
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(UNIT_MULT) as HashUnit[]).map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
