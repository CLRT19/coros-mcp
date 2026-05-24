/**
 * Shared loader: pull everything from COROS and build the WHOOP-style summary.
 * Used by the dashboard page (server component) and the AI coach route.
 *
 * Results are cached for a few minutes so a page load + coach chat in the same
 * window don't hammer the COROS API (and don't re-trigger mobile login).
 */
import {
  daysAgo,
  fetchActivities,
  fetchTrainingAnalysis,
  fetchDashboard,
  fetchSleep,
  yyyymmdd,
  type SleepNight,
} from "./coros";
import { buildSummary, type Summary } from "./metrics";

const WINDOW_DAYS = 90;
const CACHE_TTL_MS = 3 * 60 * 1000;

let cache: { at: number; summary: Summary } | null = null;
let inflight: Promise<Summary> | null = null;

async function load(): Promise<Summary> {
  const end = yyyymmdd(new Date());
  const start = yyyymmdd(daysAgo(WINDOW_DAYS));

  const [dashboard, analysis, activities] = await Promise.all([
    fetchDashboard(),
    fetchTrainingAnalysis(start, end),
    fetchActivities(start, end, 40),
  ]);

  let sleep: SleepNight[] = [];
  if (process.env.COROS_ENABLE_SLEEP === "1") {
    try {
      sleep = await fetchSleep(start, end);
    } catch {
      sleep = []; // sleep is best-effort; dashboard works without it
    }
  }

  return buildSummary(dashboard, analysis, activities, sleep);
}

export async function getSummary(force = false): Promise<Summary> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.summary;
  }
  if (inflight) return inflight;
  inflight = load()
    .then((summary) => {
      cache = { at: Date.now(), summary };
      return summary;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
