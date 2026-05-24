import { BarChart3 } from "lucide-react";
import type { Summary } from "@/lib/metrics";
import { C } from "@/lib/chartColors";
import WeeklyLoadChart from "./WeeklyLoadChart";

function ratioStatus(r: number | null): { label: string; color: string } {
  if (r == null) return { label: "–", color: C.axis };
  if (r < 0.8) return { label: "Detraining", color: C.strain };
  if (r <= 1.3) return { label: "Productive", color: C.high };
  if (r <= 1.5) return { label: "Overreaching", color: C.mid };
  return { label: "High risk", color: C.low };
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-700/60 px-3 py-2">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export default function LoadPanel({ load }: { load: Summary["load"] }) {
  const rs = ratioStatus(load.ratio);
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-coros" />
          <span className="label">Training Load</span>
        </div>
        <span className="text-[10px] text-slate-600">12-week history · intensity split</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="7-day">
          <span className="nums text-lg font-bold text-slate-100">{load.load7d ?? "–"}</span>
        </Tile>
        <Tile label="28-day">
          <span className="nums text-lg font-bold text-slate-100">{load.load28d ?? "–"}</span>
        </Tile>
        <Tile label="Load ratio">
          <div className="flex items-baseline gap-1.5">
            <span className="nums text-lg font-bold" style={{ color: rs.color }}>
              {load.ratio != null ? load.ratio.toFixed(2) : "–"}
            </span>
            <span className="text-[10px]" style={{ color: rs.color }}>
              {rs.label}
            </span>
          </div>
        </Tile>
      </div>

      <div className="mt-4">
        <WeeklyLoadChart weekly={load.weekly} />
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: C.loadLow }} /> Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: C.loadMed }} /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: C.loadHigh }} /> High
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm border border-dashed" style={{ borderColor: C.high, background: "rgba(24,194,156,0.1)" }} />
          recommended
        </span>
      </div>
    </div>
  );
}
