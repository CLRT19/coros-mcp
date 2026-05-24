import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  label,
  value,
  unit,
  sub,
  accent = "#33b1ff",
  icon: Icon,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  accent?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon size={13} style={{ color: accent }} />
        ) : (
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        )}
        <span className="label">{label}</span>
      </div>
      {value !== undefined && (
        <div className="mt-2 flex items-baseline gap-1">
          <span className="nums text-3xl font-bold text-slate-50">{value}</span>
          {unit && <span className="text-sm text-slate-400">{unit}</span>}
        </div>
      )}
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      {children}
    </div>
  );
}
