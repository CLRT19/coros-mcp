import { Activity } from "lucide-react";
import type { Summary } from "@/lib/metrics";

/** sec/km → 5'08" */
function paceStr(sec: number | null): string {
  if (!sec) return "–";
  return `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, "0")}"`;
}

function zoneStr(lo: number | null, hi: number | null): string {
  if (lo == null && hi != null) return `<${paceStr(hi)}/km`;
  if (lo != null && hi != null) return `${paceStr(lo)}–${paceStr(hi)}/km`;
  return "";
}

function timeStr(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// EvoLab scores live on a ~40-100 scale; map that span across the bar.
const barPct = (v: number | null) => (v == null ? 0 : Math.max(0, Math.min(100, ((v - 40) / 60) * 100)));

/** 270° arc gauge, 0–100, orange fill + tick marker. */
function Gauge({ value }: { value: number | null }) {
  const size = 168;
  const stroke = 11;
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const START = 135; // degrees, sweep 270° clockwise
  const SWEEP = 270;
  const frac = value != null ? Math.max(0, Math.min(1, value / 100)) : 0;
  const polar = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arcPath = (fromFrac: number, toFrac: number) => {
    const a0 = START + SWEEP * fromFrac;
    const a1 = START + SWEEP * toFrac;
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const [mx, my] = polar(START + SWEEP * frac);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="rfGauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d93c06" />
            <stop offset="100%" stopColor="#ff7a47" />
          </linearGradient>
        </defs>
        <path d={arcPath(0, 1)} fill="none" stroke="#1b1e25" strokeWidth={stroke} strokeLinecap="round" />
        {value != null && (
          <path d={arcPath(0, frac)} fill="none" stroke="url(#rfGauge)" strokeWidth={stroke} strokeLinecap="round" />
        )}
        {value != null && <circle cx={mx} cy={my} r={4} fill="#fff" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="nums text-4xl font-bold text-slate-50">{value != null ? value.toFixed(1) : "–"}</span>
      </div>
      <span className="absolute bottom-3 left-5 text-[10px] text-slate-600">0</span>
      <span className="absolute bottom-3 right-5 text-[10px] text-slate-600">100</span>
    </div>
  );
}

function Basic({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="nums text-2xl font-bold text-slate-50">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
      <div className="label mt-0.5 !text-[10px]">{label}</div>
    </div>
  );
}

export default function EvoLabPanel({ evolab }: { evolab: Summary["evolab"] }) {
  const e = evolab;
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-coros" />
        <span className="label">Running Fitness</span>
      </div>

      {/* dial + ranking */}
      <div className="mt-1 flex items-center gap-4">
        <Gauge value={e.runningFitness} />
        <div className="flex-1">
          {e.ranking != null && (
            <span className="rounded-full bg-coros/15 px-2.5 py-1 text-xs font-semibold text-coros-400">
              Top {e.ranking.toFixed(0)}%
            </span>
          )}
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Marathon-equivalent ability (40–100). Train in each pace zone below to lift the matching score.
          </p>
        </div>
      </div>

      {/* breakdown with pace zones */}
      <div className="mt-3 border-t border-ink-600/40 pt-3">
        <div className="label mb-2">Breakdown</div>
        <div className="space-y-2.5">
          {e.breakdown.map((b) => (
            <div key={b.key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-300">
                  {b.label} <span className="text-slate-600">{zoneStr(b.paceLo, b.paceHi)}</span>
                </span>
                <span className="nums font-semibold text-slate-100">{b.score != null ? b.score.toFixed(1) : "–"}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-gradient-to-r from-coros-600 to-coros-400" style={{ width: `${barPct(b.score)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* basic metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-600/40 pt-3">
        <Basic label="VO₂max" value={e.vo2max ?? "–"} />
        <Basic label="Threshold Pace" value={paceStr(e.thresholdPaceSec)} unit="/km" />
        <Basic label="Threshold HR" value={e.lthr ?? "–"} unit="bpm" />
      </div>

      {/* race predictor */}
      {e.racePredictions.length > 0 && (
        <div className="mt-3 border-t border-ink-600/40 pt-3">
          <div className="label mb-1.5">Race Predictor</div>
          <div className="grid grid-cols-3 text-[10px] text-slate-600">
            <span>Distance</span>
            <span className="text-center">Avg Pace</span>
            <span className="text-right">Time</span>
          </div>
          {e.racePredictions.map((r) => (
            <div key={r.label} className="grid grid-cols-3 py-1 text-sm">
              <span className="text-slate-300">{r.label}</span>
              <span className="nums text-center text-slate-400">{paceStr(r.paceSecPerKm)}/km</span>
              <span className="nums text-right text-slate-100">{timeStr(r.timeSec)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
