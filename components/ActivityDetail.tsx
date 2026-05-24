"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Activity, ActivityDetail as Detail } from "@/lib/coros";

const ZONE_COLORS = ["#5e6675", "#18c29c", "#ffb020", "#ff7a47", "#ff4d5e", "#d93c06"];

function pace(sec: number | null): string {
  if (!sec || sec <= 0) return "–";
  return `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, "0")}"`;
}
function dur(sec: number | null): string {
  if (!sec) return "–";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function zsec(s: number) {
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m}m` : `${s}s`;
}

function Stat({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="rounded-lg bg-ink-700/60 px-3 py-2">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="nums text-lg font-bold text-slate-100">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function ActivityDetail({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/activity/${activity.id}?sportType=${activity.sportType}`)
      .then((r) => r.json())
      .then((j) => alive && (j.error ? setErr(j.error) : setD(j)))
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [activity.id, activity.sportType]);

  const km = activity.distanceMeters ? (activity.distanceMeters / 1000).toFixed(2) : null;
  const avgPaceSec =
    activity.distanceMeters && activity.durationSeconds
      ? (activity.durationSeconds / activity.distanceMeters) * 1000
      : null;
  const date = activity.startTime ? new Date(activity.startTime * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
  const zoneTotal = d?.hrZones.reduce((a, z) => a + z.seconds, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="scroll-thin w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink-600/50 p-5">
          <div>
            <h2 className="text-base font-bold text-slate-50">{activity.name}</h2>
            <p className="text-xs text-slate-500">{activity.sportName} · {date}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-ink-700 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* headline stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Distance" value={km ?? "–"} unit={km ? "km" : undefined} />
            <Stat label="Time" value={dur(activity.durationSeconds)} />
            <Stat label="Avg Pace" value={pace(avgPaceSec)} unit="/km" />
            <Stat label="Avg HR" value={activity.avgHr ?? "–"} unit="bpm" />
            <Stat label="Max HR" value={activity.maxHr ?? "–"} unit="bpm" />
            <Stat label="Load" value={activity.trainingLoad ?? "–"} />
            {activity.ascent != null && <Stat label="Ascent" value={activity.ascent} unit="m" />}
            {activity.calories != null && <Stat label="Calories" value={activity.calories} unit="kcal" />}
            {activity.avgPower ? <Stat label="Avg Power" value={activity.avgPower} unit="W" /> : null}
          </div>

          {/* EvoLab effects */}
          {d && (d.vo2max != null || d.aerobicEffect != null || d.performance != null) && (
            <div className="grid grid-cols-3 gap-2">
              {d.vo2max != null && <Stat label="VO₂max" value={d.vo2max} />}
              {d.aerobicEffect != null && <Stat label="Aerobic" value={d.aerobicEffect.toFixed(1)} />}
              {d.anaerobicEffect != null && <Stat label="Anaerobic" value={d.anaerobicEffect.toFixed(1)} />}
            </div>
          )}

          {/* HR zones */}
          {d && d.hrZones.length > 0 && zoneTotal > 0 && (
            <div>
              <div className="label mb-2">HR Zones</div>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                {d.hrZones.map((z) =>
                  z.seconds > 0 ? (
                    <div
                      key={z.index}
                      style={{ width: `${(z.seconds / zoneTotal) * 100}%`, background: ZONE_COLORS[z.index] ?? "#5e6675" }}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-6">
                {d.hrZones.map((z) => (
                  <div key={z.index} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLORS[z.index] ?? "#5e6675" }} />
                    <span className="text-slate-400">Z{z.index + 1}</span>
                    <span className="nums ml-auto text-slate-300">{zsec(z.seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* laps */}
          {d && d.laps.length > 1 && (
            <div>
              <div className="label mb-1.5">
                Splits {d.lapSplitMeters ? `· per ${(d.lapSplitMeters / 1000).toFixed(1)} km` : ""}
              </div>
              <div className="grid grid-cols-4 text-[10px] text-slate-600">
                <span>Lap</span>
                <span className="text-right">Pace</span>
                <span className="text-right">HR</span>
                <span className="text-right">Cad</span>
              </div>
              <div className="max-h-44 overflow-y-auto scroll-thin">
                {d.laps.map((l) => (
                  <div key={l.index} className="grid grid-cols-4 border-t border-ink-600/30 py-1 text-xs">
                    <span className="text-slate-400">{l.index}</span>
                    <span className="nums text-right text-slate-200">{pace(l.avgPaceSec)}</span>
                    <span className="nums text-right text-slate-300">{l.avgHr ?? "–"}</span>
                    <span className="nums text-right text-slate-500">{l.avgCadence ?? "–"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* weather */}
          {d?.weather && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {d.weather.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.weather.icon} alt="" className="h-5 w-5" />
              )}
              {d.weather.tempC != null && <span>{d.weather.tempC}°C</span>}
              {d.weather.humidity != null && <span>· {d.weather.humidity}% humidity</span>}
            </div>
          )}

          {!d && !err && <p className="text-sm text-slate-500">Loading detail…</p>}
          {err && <p className="text-sm text-recovery-low">Couldn’t load detail: {err}</p>}
        </div>
      </div>
    </div>
  );
}
