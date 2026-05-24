"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SleepBlock } from "@/lib/metrics";
import { C, tooltipStyle } from "@/lib/chartColors";

function dLabel(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

export default function SleepHistoryChart({
  history,
  needMinutes,
}: {
  history: SleepBlock["history"];
  needMinutes: number;
}) {
  const data = history.map((h) => ({
    label: dLabel(h.date),
    Deep: +(h.deep / 60).toFixed(2),
    REM: +(h.rem / 60).toFixed(2),
    Light: +(h.light / 60).toFixed(2),
    Awake: +(h.awake / 60).toFixed(2),
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 6, bottom: 0, left: -18 }} barCategoryGap="20%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <ReferenceLine y={needMinutes / 60} stroke={C.sleep} strokeDasharray="3 3" strokeOpacity={0.5} />
          <XAxis dataKey="label" stroke={C.axis} fontSize={10} tickLine={false} minTickGap={8} />
          <YAxis stroke={C.axis} fontSize={10} tickLine={false} width={26} unit="h" />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="Deep" stackId="s" fill={C.deep} isAnimationActive={false} />
          <Bar dataKey="REM" stackId="s" fill={C.rem} isAnimationActive={false} />
          <Bar dataKey="Light" stackId="s" fill={C.light} isAnimationActive={false} />
          <Bar dataKey="Awake" stackId="s" fill={C.awake} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
