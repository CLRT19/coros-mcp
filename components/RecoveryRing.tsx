import type { RecoveryBand } from "@/lib/metrics";
import { C } from "@/lib/chartColors";

const BAND_COLOR: Record<RecoveryBand, string> = {
  high: C.high,
  mid: C.mid,
  low: C.low,
};

const BAND_LABEL: Record<RecoveryBand, string> = {
  high: "Primed",
  mid: "Moderate",
  low: "Take it easy",
};

export default function RecoveryRing({
  score,
  band,
  size = 200,
}: {
  score: number | null;
  band: RecoveryBand | null;
  size?: number;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  const dash = (pct / 100) * c;
  const color = band ? BAND_COLOR[band] : "#2a2e38";
  const gradId = `rec-${band ?? "none"}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1b1e25" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="nums text-6xl font-bold" style={{ color }}>
          {score ?? "–"}
        </span>
        <span className="mt-1 label">Recovery</span>
        {band && (
          <span className="mt-0.5 text-xs font-semibold" style={{ color }}>
            {BAND_LABEL[band]}
          </span>
        )}
      </div>
    </div>
  );
}
