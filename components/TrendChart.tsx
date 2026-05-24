"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayPoint } from "@/lib/metrics";
import { C, tooltipStyle } from "@/lib/chartColors";

type TabKey = "recovery" | "hrv" | "load" | "fitness";

const TABS: { key: TabKey; label: string }[] = [
  { key: "recovery", label: "Recovery" },
  { key: "hrv", label: "HRV / RHR" },
  { key: "load", label: "Strain" },
  { key: "fitness", label: "Fitness / Form" },
];

const axis = { stroke: C.axis, fontSize: 11 };
const legendStyle = { fontSize: 11, paddingTop: 4 };

function tipDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TrendChart({ trend }: { trend: DayPoint[] }) {
  const [tab, setTab] = useState<TabKey>("recovery");
  const data = trend.map((t) => ({ ...t, label: tipDate(t.date) }));
  const cursor = { stroke: C.axis, strokeOpacity: 0.3 };

  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              tab === t.key
                ? "bg-coros text-ink-900"
                : "bg-ink-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {tab === "recovery" ? (
            <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.high} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.high} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={28} tickLine={false} />
              <YAxis domain={[0, 100]} {...axis} tickLine={false} />
              <Tooltip {...tooltipStyle} cursor={cursor} />
              <ReferenceLine y={67} stroke={C.high} strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={34} stroke={C.low} strokeDasharray="3 3" strokeOpacity={0.4} />
              <Area isAnimationActive={false} type="monotone" dataKey="recovery" stroke={C.high} strokeWidth={2} fill="url(#recGrad)" connectNulls dot={false} name="Recovery %" />
            </AreaChart>
          ) : tab === "hrv" ? (
            <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={28} tickLine={false} />
              <YAxis {...axis} tickLine={false} />
              <Tooltip {...tooltipStyle} cursor={cursor} />
              <Legend wrapperStyle={legendStyle} />
              <Line isAnimationActive={false} type="monotone" dataKey="hrv" stroke={C.high} strokeWidth={2} connectNulls dot={false} name="HRV (ms)" />
              <Line isAnimationActive={false} type="monotone" dataKey="hrvBaseline" stroke={C.high} strokeWidth={1} strokeDasharray="4 4" connectNulls dot={false} name="HRV baseline" />
              <Line isAnimationActive={false} type="monotone" dataKey="rhr" stroke={C.low} strokeWidth={2} connectNulls dot={false} name="Resting HR" />
            </LineChart>
          ) : tab === "load" ? (
            <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.strain} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.strain} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={28} tickLine={false} />
              <YAxis domain={[0, 21]} {...axis} tickLine={false} />
              <Tooltip {...tooltipStyle} cursor={cursor} />
              <Area isAnimationActive={false} type="monotone" dataKey="strain" stroke={C.strain} strokeWidth={2} fill="url(#loadGrad)" connectNulls dot={false} name="Strain" />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={28} tickLine={false} />
              <YAxis {...axis} tickLine={false} />
              <Tooltip {...tooltipStyle} cursor={cursor} />
              <Legend wrapperStyle={legendStyle} />
              <ReferenceLine y={0} stroke={C.axis} strokeOpacity={0.5} />
              <Line isAnimationActive={false} type="monotone" dataKey="fitness" stroke={C.fitness} strokeWidth={2} connectNulls dot={false} name="Fitness" />
              <Line isAnimationActive={false} type="monotone" dataKey="fatigue" stroke={C.fatigue} strokeWidth={2} connectNulls dot={false} name="Fatigue" />
              <Line isAnimationActive={false} type="monotone" dataKey="freshness" stroke={C.form} strokeWidth={2} connectNulls dot={false} name="Form" />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
