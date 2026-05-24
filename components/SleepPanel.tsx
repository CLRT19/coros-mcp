import { Moon } from "lucide-react";
import type { Summary } from "@/lib/metrics";
import { C } from "@/lib/chartColors";
import SleepHistoryChart from "./SleepHistoryChart";

const STAGES = [
  { key: "deep", label: "Deep", color: C.deep },
  { key: "rem", label: "REM", color: C.rem },
  { key: "light", label: "Light", color: C.light },
  { key: "awake", label: "Awake", color: C.awake },
] as const;

function fmt(min: number | null | undefined) {
  if (min == null) return "–";
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

function Stat({ label, value, unit, sub }: { label: string; value: React.ReactNode; unit?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-ink-700/60 px-3 py-2">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="nums text-base font-bold text-slate-100">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export default function SleepPanel({ sleep }: { sleep: Summary["sleep"] }) {
  if (!sleep) {
    return (
      <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-sleep" />
          <span className="label">Sleep</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          Sleep stages are off (web-login-only mode). They require COROS&apos;s mobile
          API, which signs the COROS app out on your phone. To enable anyway, set{" "}
          <code className="text-slate-300">COROS_ENABLE_SLEEP=1</code> in{" "}
          <code className="text-slate-300">.env.local</code>. HRV &amp; recovery still
          work from the web API.
        </p>
      </div>
    );
  }

  const total = sleep.lastNightMinutes ?? 0;
  const s = sleep.stages;
  const sum = (s.deep ?? 0) + (s.light ?? 0) + (s.rem ?? 0) + (s.awake ?? 0) || 1;
  const hrvDelta =
    sleep.hrv != null && sleep.hrvBaseline != null ? sleep.hrv - sleep.hrvBaseline : null;
  const needHrs = Math.round((sleep.needMinutes / 60) * 10) / 10;

  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-sleep" />
          <span className="label">Sleep</span>
        </div>
        {sleep.score != null && (
          <span className="rounded-full bg-sleep/15 px-2.5 py-1 text-xs font-semibold text-sleep">
            {sleep.score.toFixed(0)}%
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="nums text-4xl font-bold text-slate-50">{fmt(total)}</span>
        <span className="text-sm text-slate-400">/ {fmt(sleep.needMinutes)}</span>
      </div>

      {/* stage bar */}
      <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {STAGES.map((st) => {
          const v = (s as any)[st.key] ?? 0;
          if (v <= 0) return null;
          return (
            <div
              key={st.key}
              style={{ width: `${(v / sum) * 100}%`, minWidth: 3, background: st.color }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        {STAGES.map((st) => {
          const v = (s as any)[st.key] as number | null;
          return (
            <div key={st.key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
              <span className="text-slate-400">{st.label}</span>
              <span className="nums ml-auto text-slate-200">{fmt(v)}</span>
              <span className="nums w-9 text-right text-slate-500">
                {v != null ? Math.round((v / sum) * 100) : 0}%
              </span>
            </div>
          );
        })}
      </div>

      {/* metrics row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Efficiency" value={sleep.efficiency ?? "–"} unit="%" sub={`in bed ${fmt(sleep.timeInBedMinutes)}`} />
        <Stat
          label="Sleep HR"
          value={sleep.hr.avg ?? "–"}
          unit="bpm"
          sub={sleep.hr.min != null ? `${sleep.hr.min}–${sleep.hr.max} range` : undefined}
        />
        <Stat
          label="Sleep HRV"
          value={sleep.hrv ?? "–"}
          unit="ms"
          sub={
            hrvDelta != null
              ? `${hrvDelta >= 0 ? "+" : ""}${hrvDelta} vs base ${sleep.hrvBaseline}`
              : sleep.hrvBaseline
                ? `base ${sleep.hrvBaseline}`
                : undefined
          }
        />
        <Stat label="7-day avg" value={fmt(sleep.avg7dMinutes)} sub={sleep.stages.nap ? `nap ${fmt(sleep.stages.nap)}` : undefined} />
      </div>

      {/* history */}
      {sleep.history.length > 1 && (
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <span className="label !text-[10px]">Last {sleep.history.length} nights</span>
            <span className="text-[10px] text-slate-600">dashed = {needHrs}h need</span>
          </div>
          <SleepHistoryChart history={sleep.history} needMinutes={sleep.needMinutes} />
        </div>
      )}
    </div>
  );
}
