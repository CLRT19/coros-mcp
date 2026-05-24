/**
 * WHOOP-style scoring + COROS EvoLab metrics on top of raw COROS data.
 *
 *  Recovery (0-100%)  — HRV vs baseline + RHR vs baseline + sleep performance.
 *  Strain   (0-21)    — logarithmic map of daily training load (WHOOP scale).
 *  Sleep    (0-100%)  — hours slept vs need × efficiency, + stages / HR / HRV.
 *  EvoLab             — COROS running fitness, thresholds, breakdown scores.
 *  Load               — 7d / 28d load, acute:chronic ratio, weekly history.
 *
 * Baselines use a *trailing* window that excludes the day being scored, so a
 * day's recovery is causal (never compared against its own future).
 */

import type {
  Activity,
  DailyRecord,
  DashboardData,
  SleepNight,
  TrainingAnalysis,
  WeeklyLoad,
} from "./coros";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Linear-interpolated percentile of a pre-sorted array. */
function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Mean of `pick(arr[j])` for the `window` days strictly before index `idx`. */
function trailingAvg<T>(
  arr: T[],
  idx: number,
  window: number,
  pick: (t: T) => number | null,
): number | null {
  const start = Math.max(0, idx - window);
  return avg(
    arr.slice(start, idx).map(pick).filter((x): x is number => x != null),
  );
}

function ymdToDate(n: number): Date {
  const s = String(n);
  return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
}

export type RecoveryBand = "high" | "mid" | "low";

export function recoveryBand(pct: number): RecoveryBand {
  if (pct >= 67) return "high";
  if (pct >= 34) return "mid";
  return "low";
}

export interface DayPoint {
  day: number;
  date: string;
  recovery: number | null;
  strain: number | null;
  hrv: number | null;
  hrvBaseline: number | null;
  rhr: number | null;
  fitness: number | null;
  fatigue: number | null;
  freshness: number | null;
  load: number | null;
  sleepHours: number | null;
}

export interface SleepBlock {
  score: number | null;
  efficiency: number | null;
  lastNightMinutes: number | null;
  timeInBedMinutes: number | null;
  needMinutes: number;
  stages: {
    deep: number | null;
    light: number | null;
    rem: number | null;
    awake: number | null;
    nap: number | null;
  };
  hr: { avg: number | null; min: number | null; max: number | null };
  hrv: number | null;
  hrvBaseline: number | null;
  quality: number | null;
  history: {
    date: string;
    deep: number;
    light: number;
    rem: number;
    awake: number;
    total: number;
  }[];
  avg7dMinutes: number | null;
}

export interface Summary {
  generatedAt: string;
  recovery: {
    score: number | null;
    band: RecoveryBand | null;
    drivers: { hrv: number | null; rhr: number | null; sleep: number | null };
    hrv: number | null;
    hrvBaseline: number | null;
    rhr: number | null;
    rhrBaseline: number | null;
    corosRecoveryPct: number | null;
    fullRecoveryHours: number | null;
    asOf: string | null; // date of the night this recovery reflects
  };
  strain: {
    today: number | null;
    weekAvg: number | null;
    loadToday: number | null;
    loadRef: number;
  };
  sleep: SleepBlock | null;
  fitness: {
    current: number | null;
    fatigue: number | null;
    form: number | null;
    vo2max: number | null;
    staminaLevel: number | null;
    trend7d: number | null;
  };
  evolab: {
    runningFitness: number | null;
    ranking: number | null;
    endurance: number | null;
    threshold: number | null;
    sprint: number | null;
    speed: number | null;
    lthr: number | null;
    thresholdPaceSec: number | null;
    maxHr: number | null;
    rhr: number | null;
  };
  load: {
    load7d: number | null;
    load28d: number | null;
    ratio: number | null;
    recMin: number | null;
    recMax: number | null;
    weekly: WeeklyLoad[];
  };
  trend: DayPoint[];
  recentActivities: Activity[];
}

function fmtDate(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function loadToStrain(load: number | null, loadRef: number): number | null {
  if (load == null) return null;
  if (load <= 0) return 0;
  const ref = Math.max(loadRef, 50);
  const strain = 21 * (Math.log1p(load) / Math.log1p(ref * 1.15));
  return Math.round(Math.min(21, strain) * 10) / 10;
}

function computeRecovery(
  hrv: number | null,
  hrvBaseline: number | null,
  rhr: number | null,
  rhrBaseline: number | null,
  sleepPerf: number | null,
): { score: number | null; drivers: { hrv: number | null; rhr: number | null; sleep: number | null } } {
  const parts: { score: number; weight: number }[] = [];
  let hrvScore: number | null = null;
  let rhrScore: number | null = null;

  if (hrv != null && hrvBaseline) {
    const dev = (hrv - hrvBaseline) / hrvBaseline;
    // softer gain than before: ±25% HRV spans the full range (was ±20%)
    hrvScore = clamp(50 + dev * 200);
    parts.push({ score: hrvScore, weight: 0.5 });
  }
  if (rhr != null && rhrBaseline) {
    const dev = (rhrBaseline - rhr) / rhrBaseline;
    // ±17% RHR spans the full range (was ±10%)
    rhrScore = clamp(50 + dev * 300);
    parts.push({ score: rhrScore, weight: 0.3 });
  }
  if (sleepPerf != null) parts.push({ score: clamp(sleepPerf), weight: 0.2 });

  if (!parts.length) {
    return { score: null, drivers: { hrv: hrvScore, rhr: rhrScore, sleep: sleepPerf } };
  }
  const wsum = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum);
  return {
    score,
    drivers: { hrv: hrvScore, rhr: rhrScore, sleep: sleepPerf == null ? null : clamp(sleepPerf) },
  };
}

/** Sleep performance = duration vs need, scaled by in-sleep efficiency. */
function sleepScore(night: SleepNight | undefined, needMin: number): number | null {
  if (!night || night.totalMinutes == null) return null;
  const base = clamp((night.totalMinutes / needMin) * 100);
  const inBed = night.totalMinutes + (night.awakeMinutes ?? 0);
  const eff = inBed > 0 ? night.totalMinutes / inBed : 1;
  return clamp(base * eff);
}

function buildSleepBlock(
  sleep: SleepNight[],
  dashboard: DashboardData,
  needMinutes: number,
): SleepBlock | null {
  if (!sleep.length) return null;
  const last = sleep[sleep.length - 1];
  const asleep = last.totalMinutes ?? 0;
  const awake = last.awakeMinutes ?? 0;
  const inBed = asleep + awake;
  const latestHrv = [...dashboard.hrv].reverse().find((h) => h.avgSleepHrv != null);

  const history = sleep.slice(-14).map((n) => ({
    date: fmtDate(n.day),
    deep: n.deepMinutes ?? 0,
    light: n.lightMinutes ?? 0,
    rem: n.remMinutes ?? 0,
    awake: n.awakeMinutes ?? 0,
    total: n.totalMinutes ?? 0,
  }));
  const avg7d = avg(
    sleep.slice(-7).map((n) => n.totalMinutes).filter((x): x is number => x != null),
  );

  return {
    score: sleepScore(last, needMinutes),
    efficiency: inBed ? Math.round((asleep / inBed) * 100) : null,
    lastNightMinutes: last.totalMinutes,
    timeInBedMinutes: inBed || null,
    needMinutes,
    stages: {
      deep: last.deepMinutes,
      light: last.lightMinutes,
      rem: last.remMinutes,
      awake: last.awakeMinutes,
      nap: last.napMinutes,
    },
    hr: { avg: last.avgHr, min: last.minHr, max: last.maxHr },
    hrv: latestHrv?.avgSleepHrv ?? null,
    hrvBaseline: latestHrv?.baseline ?? dashboard.hrvBaseline,
    quality: last.quality,
    history,
    avg7dMinutes: avg7d != null ? Math.round(avg7d) : null,
  };
}

export function buildSummary(
  dashboard: DashboardData,
  analysis: TrainingAnalysis,
  activities: Activity[],
  sleep: SleepNight[],
): Summary {
  const needMinutes = 480;
  const daily = analysis.daily;
  const sleepByDay = new Map(sleep.map((s) => [s.day, s]));
  const hrvByDay = new Map(dashboard.hrv.map((h) => [h.day, h]));

  // Fallbacks for baselines when no trailing data exists.
  const overallRhr = avg(daily.map((d) => d.rhr).filter((x): x is number => x != null));
  const hrvFallback =
    dashboard.hrvBaseline ??
    avg(dashboard.hrv.map((h) => h.baseline).filter((x): x is number => x != null)) ??
    avg(dashboard.hrv.map((h) => h.avgSleepHrv).filter((x): x is number => x != null));

  // Strain reference: 90th-percentile of recent nonzero daily loads.
  const loads = daily.map((d) => d.trainingLoad ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  const loadRef = percentile(loads, 0.9) ?? 200;

  // Per-day recovery uses a trailing 30-day baseline (excludes that day).
  const TRAIL = 30;
  const dayRhrBaseline = (i: number) => trailingAvg(daily, i, TRAIL, (d) => d.rhr) ?? overallRhr;

  const trend: DayPoint[] = daily.map((d, i) => {
    const night = sleepByDay.get(d.day);
    const hrvNight = hrvByDay.get(d.day);
    const hrvBase = hrvNight?.baseline ?? hrvFallback;
    const sleepHours =
      night?.totalMinutes != null ? Math.round((night.totalMinutes / 60) * 10) / 10 : null;
    const recovery = computeRecovery(
      hrvNight?.avgSleepHrv ?? null,
      hrvBase,
      d.rhr,
      dayRhrBaseline(i),
      sleepScore(night, needMinutes),
    ).score;
    return {
      day: d.day,
      date: fmtDate(d.day),
      recovery,
      strain: loadToStrain(d.trainingLoad, loadRef),
      hrv: hrvNight?.avgSleepHrv ?? null,
      hrvBaseline: hrvBase,
      rhr: d.rhr,
      fitness: d.fitness,
      fatigue: d.fatigue,
      freshness: d.freshness,
      load: d.trainingLoad,
      sleepHours,
    };
  });

  // Headline = the most recent *settled* day (one with an HRV night), so it
  // never reads a partially-recorded "today". Falls back to any day with a
  // recovery score. This guarantees the headline equals a trend point.
  let headIdx = -1;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (trend[i].recovery != null && trend[i].hrv != null) { headIdx = i; break; }
  }
  if (headIdx < 0) {
    for (let i = daily.length - 1; i >= 0; i--) {
      if (trend[i].recovery != null) { headIdx = i; break; }
    }
  }

  const headDaily = headIdx >= 0 ? daily[headIdx] : daily[daily.length - 1];
  const headPoint = headIdx >= 0 ? trend[headIdx] : undefined;
  const headRhrBase = headIdx >= 0 ? dayRhrBaseline(headIdx) : overallRhr;
  const headSleep = headDaily ? sleepByDay.get(headDaily.day) : undefined;
  const rec = computeRecovery(
    headPoint?.hrv ?? null,
    headPoint?.hrvBaseline ?? hrvFallback,
    headDaily?.rhr ?? null,
    headRhrBase,
    sleepScore(headSleep, needMinutes),
  );
  const recoveryScore = rec.score ?? dashboard.recoveryPct;

  // Strain today (latest record, may be a rest day = 0).
  const latestDaily = daily[daily.length - 1];
  const loadToday = latestDaily?.trainingLoad ?? null;
  const strainToday = loadToStrain(loadToday, loadRef);
  const weekStrains = trend.slice(-7).map((t) => t.strain).filter((x): x is number => x != null);

  // Fitness 7-day delta: look up the record nearest to 7 days before the latest.
  let trend7d: number | null = null;
  const fitnessDays = daily.filter((d) => d.fitness != null);
  if (fitnessDays.length >= 2) {
    const latest = fitnessDays[fitnessDays.length - 1];
    const targetMs = ymdToDate(latest.day).getTime() - 7 * 86400_000;
    let best: DailyRecord | null = null;
    let bestDiff = Infinity;
    for (const d of fitnessDays) {
      const diff = Math.abs(ymdToDate(d.day).getTime() - targetMs);
      if (diff < bestDiff) { bestDiff = diff; best = d; }
    }
    if (best && bestDiff <= 3 * 86400_000 && best.day !== latest.day) {
      trend7d = Math.round((latest.fitness! - best.fitness!) * 10) / 10;
    }
  }

  const vo2max = [...daily].reverse().find((d) => d.vo2max != null)?.vo2max ?? null;

  return {
    generatedAt: new Date().toISOString(),
    recovery: {
      score: recoveryScore,
      band: recoveryScore != null ? recoveryBand(recoveryScore) : null,
      drivers: rec.drivers,
      hrv: headPoint?.hrv ?? null,
      hrvBaseline: headPoint?.hrvBaseline ?? hrvFallback,
      rhr: headDaily?.rhr ?? dashboard.rhr,
      rhrBaseline: headRhrBase != null ? Math.round(headRhrBase) : null,
      corosRecoveryPct: dashboard.recoveryPct,
      fullRecoveryHours: dashboard.fullRecoveryHours,
      asOf: headDaily ? fmtDate(headDaily.day) : null,
    },
    strain: {
      today: strainToday,
      weekAvg: weekStrains.length ? Math.round(avg(weekStrains)! * 10) / 10 : null,
      loadToday,
      loadRef: Math.round(loadRef),
    },
    sleep: buildSleepBlock(sleep, dashboard, needMinutes),
    fitness: {
      current: latestDaily?.fitness ?? null,
      fatigue: latestDaily?.fatigue ?? null,
      form: latestDaily?.freshness ?? null,
      vo2max,
      staminaLevel: dashboard.staminaLevel,
      trend7d,
    },
    evolab: {
      // COROS "Running Fitness" = staminaLevel (40-100). The four breakdown
      // spokes share the same scale; for a balanced runner they cluster.
      runningFitness: dashboard.staminaLevel,
      ranking: dashboard.staminaRanking,
      endurance: dashboard.aerobicEnduranceScore,
      threshold: dashboard.thresholdScore,
      sprint: dashboard.anaerobicCapacityScore,
      speed: dashboard.anaerobicEnduranceScore,
      lthr: dashboard.lthr,
      thresholdPaceSec: dashboard.ltsp,
      maxHr: dashboard.maxHr,
      rhr: dashboard.rhr,
    },
    load: {
      load7d: latestDaily?.load7d ?? null,
      load28d: latestDaily?.load28d ?? null,
      ratio: latestDaily?.loadRatio ?? null,
      recMin: latestDaily?.recTlMin ?? null,
      recMax: latestDaily?.recTlMax ?? null,
      weekly: analysis.weekly,
    },
    trend,
    recentActivities: activities.slice(0, 10),
  };
}
