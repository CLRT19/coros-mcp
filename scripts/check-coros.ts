/**
 * Smoke test: log in to COROS, pull the real data, and print the computed
 * WHOOP-style summary. Run with `npm run coros:check`.
 */
import {
  fetchActivities,
  fetchTrainingAnalysis,
  fetchDashboard,
  fetchSleep,
  yyyymmdd,
  daysAgo,
} from "../lib/coros";
import { buildSummary } from "../lib/metrics";

// Node 24 built-in: load env without a dependency.
try {
  (process as any).loadEnvFile(".env.local");
} catch {
  /* env may already be set */
}

async function main() {
  const end = yyyymmdd(new Date());
  const start = yyyymmdd(daysAgo(60));

  console.log(`Fetching COROS data ${start} → ${end} ...\n`);

  const [dashboard, analysis, activities] = await Promise.all([
    fetchDashboard(),
    fetchTrainingAnalysis(start, end),
    fetchActivities(start, end, 30),
  ]);
  const daily = analysis.daily;

  let sleep: Awaited<ReturnType<typeof fetchSleep>> = [];
  if (process.env.COROS_ENABLE_SLEEP === "1") {
    try {
      sleep = await fetchSleep(start, end);
    } catch (e) {
      console.warn("sleep fetch failed:", (e as Error).message);
    }
  }

  console.log("Dashboard recovery%:", dashboard.recoveryPct);
  console.log("HRV nights:", dashboard.hrv.length, "baseline:", dashboard.hrvBaseline);
  console.log("Daily records:", daily.length);
  console.log("Activities:", activities.length);
  console.log("Sleep nights:", sleep.length);
  console.log("");

  const summary = buildSummary(dashboard, analysis, activities, sleep);
  console.log("=== WHOOP-STYLE SUMMARY ===");
  console.log("Recovery:", summary.recovery.score, `(${summary.recovery.band})`);
  console.log("  drivers:", summary.recovery.drivers);
  console.log("  HRV:", summary.recovery.hrv, "base", summary.recovery.hrvBaseline);
  console.log("  RHR:", summary.recovery.rhr, "base", summary.recovery.rhrBaseline);
  console.log("Strain today:", summary.strain.today, "week avg:", summary.strain.weekAvg);
  console.log("Sleep:", summary.sleep ? `${summary.sleep.lastNightMinutes}min score ${summary.sleep.score}` : "n/a");
  console.log("Fitness:", summary.fitness.current, "fatigue", summary.fitness.fatigue, "form", summary.fitness.form, "vo2", summary.fitness.vo2max);
  console.log("Trend points:", summary.trend.length);
  console.log("Recent activities:", summary.recentActivities.map((a) => `${a.sportName} ${a.name}`).slice(0, 5));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
