"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyLoad } from "@/lib/coros";
import { C, tooltipStyle } from "@/lib/chartColors";

function wkLabel(yyyymmdd: number) {
  const s = String(yyyymmdd);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

export default function WeeklyLoadChart({ weekly }: { weekly: WeeklyLoad[] }) {
  const data = weekly.map((w) => ({
    label: wkLabel(w.weekStart),
    Low: w.low ?? 0,
    Medium: w.medium ?? 0,
    High: w.high ?? 0,
    total: w.load,
  }));
  const last = weekly[weekly.length - 1];
  const recMin = last?.recMin ?? null;
  const recMax = last?.recMax ?? null;

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 6, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          {recMin != null && recMax != null && (
            <ReferenceArea
              y1={recMin}
              y2={recMax}
              fill={C.high}
              fillOpacity={0.08}
              stroke={C.high}
              strokeOpacity={0.25}
              strokeDasharray="3 3"
            />
          )}
          <XAxis dataKey="label" stroke={C.axis} fontSize={10} tickLine={false} minTickGap={10} />
          <YAxis stroke={C.axis} fontSize={10} tickLine={false} width={26} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="Low" stackId="a" fill={C.loadLow} isAnimationActive={false} />
          <Bar dataKey="Medium" stackId="a" fill={C.loadMed} isAnimationActive={false} />
          <Bar dataKey="High" stackId="a" fill={C.loadHigh} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
