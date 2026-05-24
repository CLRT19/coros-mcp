import { C } from "@/lib/chartColors";

/** WHOOP-style 0-21 strain gauge (semicircular arc). */
export default function StrainGauge({
  strain,
  weekAvg,
  load,
}: {
  strain: number | null;
  weekAvg: number | null;
  load: number | null;
}) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const semi = Math.PI * r;
  const pct = Math.min(1, (strain ?? 0) / 21);

  const arc = (frac: number) => {
    const a = Math.PI + frac * Math.PI;
    return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  };

  const s = strain ?? 0;
  const label =
    strain == null ? "" : s < 10 ? "Light" : s < 14 ? "Moderate" : s < 18 ? "Strenuous" : "All Out";
  const color = s < 14 ? C.strain : s < 18 ? C.coros400 : C.low;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 14 }}>
        <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`}>
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="#1b1e25"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${arc(pct)}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-x-0" style={{ top: cy - 44 }}>
          <div className="flex flex-col items-center">
            <span className="nums text-4xl font-bold text-slate-50">
              {strain != null ? strain.toFixed(1) : "–"}
            </span>
            <span className="text-xs font-medium" style={{ color }}>
              {label}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex w-full justify-between px-3">
        <div>
          <div className="label !text-[10px]">7-day avg</div>
          <div className="nums text-sm text-slate-200">{weekAvg != null ? weekAvg.toFixed(1) : "–"}</div>
        </div>
        <div className="text-right">
          <div className="label !text-[10px]">Load</div>
          <div className="nums text-sm text-slate-200">{load ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
