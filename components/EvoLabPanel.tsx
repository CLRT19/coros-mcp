import { Activity } from "lucide-react";
import type { Summary } from "@/lib/metrics";

function pace(sec: number | null): string {
  if (!sec) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// EvoLab scores live on a ~40-100 scale; map that span across the bar.
function barPct(v: number | null): number {
  if (v == null) return 0;
  return Math.max(0, Math.min(100, ((v - 40) / 60) * 100));
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="nums font-medium text-slate-200">{value != null ? value.toFixed(1) : "–"}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-coros-600 to-coros-400"
          style={{ width: `${barPct(value)}%` }}
        />
      </div>
    </div>
  );
}

function Mini({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="rounded-lg bg-ink-700/60 px-3 py-2">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="nums text-base font-bold text-slate-100">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function Dial({ value }: { value: number | null }) {
  const size = 96;
  const stroke = 9;
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  const frac = value != null ? Math.max(0, Math.min(1, (value - 40) / 60)) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="rfDial" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d93c06" />
            <stop offset="100%" stopColor="#ff7a47" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={rad} stroke="#1b1e25" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rad}
          stroke="url(#rfDial)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${frac * circ} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="nums text-3xl font-bold text-coros">{value != null ? Math.round(value) : "–"}</span>
      </div>
    </div>
  );
}

export default function EvoLabPanel({ evolab }: { evolab: Summary["evolab"] }) {
  const e = evolab;
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-coros" />
        <span className="label">EvoLab · Running Fitness</span>
      </div>

      <div className="mt-2 flex items-center gap-4">
        <Dial value={e.runningFitness} />
        <div>
          {e.ranking != null && (
            <span className="rounded-full bg-coros/15 px-2.5 py-1 text-xs font-semibold text-coros-400">
              Top {e.ranking.toFixed(0)}%
            </span>
          )}
          <p className="mt-2 max-w-[12rem] text-xs leading-snug text-slate-500">
            Marathon-equivalent ability on a 40–100 scale.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        <ScoreBar label="Endurance" value={e.endurance} />
        <ScoreBar label="Threshold" value={e.threshold} />
        <ScoreBar label="Sprint" value={e.sprint} />
        <ScoreBar label="Speed" value={e.speed} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Mini label="LTHR" value={e.lthr ?? "–"} unit="bpm" />
        <Mini label="Thr pace" value={pace(e.thresholdPaceSec)} unit="/km" />
        <Mini label="Max HR" value={e.maxHr ?? "–"} unit="bpm" />
        <Mini label="Rest HR" value={e.rhr ?? "–"} unit="bpm" />
      </div>
    </div>
  );
}
