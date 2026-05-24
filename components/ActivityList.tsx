"use client";

import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Bike, Dumbbell, Footprints, Mountain, Waves, type LucideIcon } from "lucide-react";
import type { Activity } from "@/lib/coros";
import ActivityDetail from "./ActivityDetail";

function fmtDate(unixSec: number) {
  if (!unixSec) return "";
  return new Date(unixSec * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dur(sec: number | null) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function sportIcon(sportType: number): LucideIcon {
  if (sportType === 102 || sportType === 104 || sportType === 105) return Mountain;
  if (sportType >= 100 && sportType < 200) return Footprints;
  if (sportType >= 200 && sportType < 300) return Bike;
  if (sportType >= 300 && sportType < 400) return Waves;
  if (sportType === 402) return Dumbbell;
  if (sportType === 900) return Footprints;
  return ActivityIcon;
}

export default function ActivityList({ activities }: { activities: Activity[] }) {
  const [selected, setSelected] = useState<Activity | null>(null);

  // Deep-link: ?activity=<id> opens that activity on load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("activity");
    if (id) setSelected(activities.find((a) => a.id === id) ?? null);
  }, [activities]);
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
      <span className="label">Recent activities</span>
      <div className="mt-2 divide-y divide-ink-600/40">
        {activities.length === 0 && (
          <p className="py-4 text-sm text-slate-500">No activities in the last 90 days.</p>
        )}
        {activities.map((a) => {
          const Icon = sportIcon(a.sportType);
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="flex w-full items-center gap-3 py-2.5 text-left transition hover:opacity-80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-slate-300">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{a.name}</div>
                <div className="text-xs text-slate-500">
                  {fmtDate(a.startTime)} · {a.sportName}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-400">
                <div className="nums text-slate-200">
                  {a.distanceMeters ? (a.distanceMeters / 1000).toFixed(1) + " km" : dur(a.durationSeconds)}
                </div>
                <div className="nums">
                  {a.avgHr ? `${a.avgHr} bpm` : ""}
                  {a.trainingLoad ? ` · ${a.trainingLoad} TL` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected && <ActivityDetail activity={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
