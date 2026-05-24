/**
 * COROS Training Hub API client (server-side only).
 *
 * Auth: MD5-hashed password + `accessToken` header on the regional web host.
 * Endpoints reverse-engineered from the COROS Training Hub web app and the
 * COROS mobile app. Unofficial — COROS can change these at any time.
 *
 *   /account/login              -> accessToken + userId
 *   /dashboard/query            -> recovery state + 7-day nightly HRV
 *   /analyse/dayDetail/query    -> daily fitness/fatigue/load/RHR (up to ~24 weeks)
 *   /analyse/query              -> VO2max / LTHR / stamina (last ~28 days)
 *   /activity/query             -> workout list
 *   /coros/data/statistic/daily -> sleep stages (mobile API, AES login)
 */

import crypto from "node:crypto";

export type Region = "us" | "eu" | "cn";

const WEB_BASE: Record<Region, string> = {
  us: "https://teamapi.coros.com",
  eu: "https://teameuapi.coros.com",
  cn: "https://teamcnapi.coros.com",
};

const MOBILE_BASE: Record<Region, string> = {
  us: "https://api.coros.com",
  eu: "https://apieu.coros.com",
  cn: "https://apicn.coros.com",
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

// AES IV hardcoded in COROS's libencrypt-lib.so (used by the mobile login).
const MOBILE_AES_IV = Buffer.from("weloop3_2015_03#", "ascii");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // re-login every 12h

function md5(value: string): string {
  return crypto.createHash("md5").update(value, "utf8").digest("hex");
}

export interface Auth {
  accessToken: string;
  userId: string;
  region: Region;
  ts: number;
  mobileToken?: string;
}

// ---------------------------------------------------------------------------
// Token cache (in-memory; the Next dev/prod server process is long-lived)
// ---------------------------------------------------------------------------

let cachedAuth: Auth | null = null;
let inflight: Promise<Auth> | null = null;

function region(): Region {
  const r = (process.env.COROS_REGION || "us").toLowerCase();
  return r === "eu" || r === "cn" ? r : "us";
}

function credentials(): { email: string; password: string } {
  const email = process.env.COROS_EMAIL;
  const password = process.env.COROS_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "COROS_EMAIL and COROS_PASSWORD must be set in .env.local",
    );
  }
  return { email, password };
}

async function login(): Promise<Auth> {
  const { email, password } = credentials();
  const reg = region();
  const res = await fetch(`${WEB_BASE[reg]}/account/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ account: email, accountType: 2, pwd: md5(password) }),
  });
  const body = await res.json();
  if (body?.result !== "0000" || !body?.data?.accessToken) {
    throw new Error(`COROS login failed: ${body?.message || res.status}`);
  }
  return {
    accessToken: body.data.accessToken,
    userId: String(body.data.userId),
    region: reg,
    ts: Date.now(),
  };
}

/** Get a valid auth, re-using the cached token until it expires. */
export async function getAuth(): Promise<Auth> {
  if (cachedAuth && Date.now() - cachedAuth.ts < TOKEN_TTL_MS) {
    return cachedAuth;
  }
  if (inflight) return inflight;
  inflight = login()
    .then((a) => {
      cachedAuth = a;
      return a;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function authHeaders(auth: Auth): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    accessToken: auth.accessToken,
    // Some endpoints (e.g. /activity/detail/query) return result:1001 without
    // this header; harmless on the others.
    yfheader: JSON.stringify({ userId: auth.userId }),
  };
}

/** GET a web endpoint, retrying once with a fresh token on auth failure. */
async function webGet<T = any>(path: string): Promise<T> {
  let auth = await getAuth();
  const url = `${WEB_BASE[auth.region]}${path}`;
  let res = await fetch(url, { headers: authHeaders(auth) });
  let body = await res.json().catch(() => ({}));
  if (body?.result && body.result !== "0000") {
    // token likely stale — force re-login once
    cachedAuth = null;
    auth = await getAuth();
    res = await fetch(url, { headers: authHeaders(auth) });
    body = await res.json().catch(() => ({}));
  }
  if (body?.result && body.result !== "0000") {
    throw new Error(`COROS ${path} error: ${body?.message || res.status}`);
  }
  return body.data as T;
}

// ---------------------------------------------------------------------------
// Date helpers — COROS uses YYYYMMDD integers
// ---------------------------------------------------------------------------

export function yyyymmdd(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---------------------------------------------------------------------------
// Dashboard — recovery state + nightly HRV
// ---------------------------------------------------------------------------

export interface HrvNight {
  day: number;
  avgSleepHrv: number | null;
  baseline: number | null;
  sd: number | null;
}

export interface PaceZone {
  pace: number; // sec/km
  ratio: number; // % of threshold pace
}

export interface RacePrediction {
  label: string; // "5K" | "10K" | "Half" | "Marathon"
  distanceM: number;
  timeSec: number; // predicted finish time
  paceSecPerKm: number;
}

export interface DashboardData {
  recoveryPct: number | null;
  recoveryState: number | null;
  fullRecoveryHours: number | null;
  rhr: number | null;
  staminaLevel: number | null;
  staminaLevelChange: number | null;
  staminaRanking: number | null; // percentile (lower = better, "top X%")
  lthr: number | null; // lactate threshold HR (bpm)
  ltsp: number | null; // lactate threshold pace (sec/km)
  maxHr: number | null;
  vo2max: number | null; // from run tests; surfaced via /dashboard/detail/query
  aerobicEnduranceScore: number | null;
  anaerobicCapacityScore: number | null;
  anaerobicEnduranceScore: number | null;
  thresholdScore: number | null; // lactateThresholdCapacityScore
  paceZones: PaceZone[]; // ltspZone — used to derive ability pace ranges
  racePredictions: RacePrediction[]; // from runScoreList
  hrv: HrvNight[];
  hrvBaseline: number | null;
}

// runScoreList "type" → standard race distance
const RACE_TYPES: Record<number, { label: string; distanceM: number }> = {
  1: { label: "Marathon", distanceM: 42195 },
  2: { label: "Half", distanceM: 21097 },
  4: { label: "10K", distanceM: 10000 },
  5: { label: "5K", distanceM: 5000 },
};

/** Latest non-zero VO2max from run tests (web endpoint, last ~7 days). */
async function fetchVo2max(): Promise<number | null> {
  try {
    const data = await webGet<any>("/dashboard/detail/query");
    const list = (data?.detailList ?? []) as any[];
    const vals = list.map((e) => e?.vo2max).filter((v) => typeof v === "number" && v > 0);
    return vals.length ? vals[vals.length - 1] : null;
  } catch {
    return null;
  }
}

export async function fetchDashboard(): Promise<DashboardData> {
  const [data, vo2max] = await Promise.all([webGet<any>("/dashboard/query"), fetchVo2max()]);
  const s = data?.summaryInfo ?? {};

  const racePredictions: RacePrediction[] = (s.runScoreList ?? [])
    .filter((r: any) => RACE_TYPES[r.type] && (r.duration ?? 0) > 0 && (r.avgPace ?? 0) > 0)
    .map((r: any) => ({
      label: RACE_TYPES[r.type].label,
      distanceM: RACE_TYPES[r.type].distanceM,
      timeSec: r.duration,
      paceSecPerKm: r.avgPace,
    }))
    .sort((a: RacePrediction, b: RacePrediction) => a.distanceM - b.distanceM);

  const paceZones: PaceZone[] = (s.ltspZone ?? [])
    .filter((z: any) => z?.pace > 0)
    .map((z: any) => ({ pace: z.pace, ratio: z.ratio }));
  const hrvData = s.sleepHrvData ?? {};
  const nights: HrvNight[] = (hrvData.sleepHrvList ?? []).map((it: any) => ({
    day: it.happenDay,
    avgSleepHrv: it.avgSleepHrv ?? null,
    baseline: it.sleepHrvBase ?? null,
    sd: it.sleepHrvSd ?? null,
  }));
  // Most recent night may live on the summary object itself
  if (hrvData.happenDay && !nights.some((n) => n.day === hrvData.happenDay)) {
    nights.push({
      day: hrvData.happenDay,
      avgSleepHrv: hrvData.avgSleepHrv ?? null,
      baseline: hrvData.lastSleepHrvBase ?? hrvData.sleepHrvBase ?? null,
      sd: hrvData.lastSleepHrvSd ?? null,
    });
  }
  nights.sort((a, b) => a.day - b.day);
  return {
    recoveryPct: s.recoveryPct ?? null,
    recoveryState: s.recoveryState ?? null,
    fullRecoveryHours: s.fullRecoveryHours ?? null,
    rhr: s.rhr ?? null,
    staminaLevel: s.staminaLevel ?? null,
    staminaLevelChange: s.staminaLevelChange ?? null,
    staminaRanking: s.staminaLevelRanking ?? null,
    lthr: s.lthr ?? null,
    ltsp: s.ltsp ?? null,
    maxHr: s.fitnessMaxHr ?? null,
    vo2max,
    aerobicEnduranceScore: s.aerobicEnduranceScore ?? null,
    anaerobicCapacityScore: s.anaerobicCapacityScore ?? null,
    anaerobicEnduranceScore: s.anaerobicEnduranceScore ?? null,
    thresholdScore: s.lactateThresholdCapacityScore ?? null,
    paceZones,
    racePredictions,
    hrv: nights,
    hrvBaseline:
      hrvData.lastSleepHrvBase ??
      hrvData.sleepHrvIntervalBase ??
      (nights.length ? nights[nights.length - 1].baseline : null),
  };
}

// ---------------------------------------------------------------------------
// Daily analysis — fitness (CTI), fatigue (ATI), freshness, load, RHR
// ---------------------------------------------------------------------------

export interface DailyRecord {
  day: number;
  rhr: number | null;
  trainingLoad: number | null;
  fitness: number | null; // cti — chronic training impact (~CTL)
  fatigue: number | null; // ati — acute training impact (~ATL)
  base: number | null; // tib — training impact base
  freshness: number | null; // tiredRateNew — form/freshness (~TSB)
  freshnessState: number | null;
  load7d: number | null; // t7d — 7-day load total
  load28d: number | null; // t28d — 28-day load total
  loadRatio: number | null; // acute:chronic (~ACWR)
  recTlMin: number | null; // recommended load range
  recTlMax: number | null;
  performance: number | null;
  distance: number | null; // meters
  duration: number | null; // seconds
  vo2max?: number | null;
  staminaLevel?: number | null;
}

export interface WeeklyLoad {
  weekStart: number; // YYYYMMDD
  load: number;
  recMin: number | null;
  recMax: number | null;
  low: number | null; // training-load intensity split
  medium: number | null;
  high: number | null;
}

export interface TrainingAnalysis {
  daily: DailyRecord[];
  weekly: WeeklyLoad[];
}

export async function fetchTrainingAnalysis(
  startDay: number,
  endDay: number,
): Promise<TrainingAnalysis> {
  const [detail, analyse] = await Promise.all([
    webGet<any>(`/analyse/dayDetail/query?startDay=${startDay}&endDay=${endDay}`),
    webGet<any>(`/analyse/query`).catch(() => null),
  ]);

  const byDay = new Map<number, DailyRecord>();
  for (const it of detail?.dayList ?? []) {
    byDay.set(it.happenDay, {
      day: it.happenDay,
      rhr: it.rhr ?? null,
      trainingLoad: it.trainingLoad ?? null,
      fitness: it.cti ?? null,
      fatigue: it.ati ?? null,
      base: it.tib ?? null,
      freshness: it.tiredRateNew ?? null,
      freshnessState: it.tiredRateStateNew ?? null,
      load7d: it.t7d ?? null,
      load28d: it.t28d ?? null,
      loadRatio: it.trainingLoadRatio ?? null,
      recTlMin: it.recomendTlMin ?? null,
      recTlMax: it.recomendTlMax ?? null,
      performance: it.performance === -1 ? null : it.performance ?? null,
      distance: it.distance ?? null,
      duration: it.duration ?? null,
    });
  }
  // Merge VO2max / stamina + recent load fields from the analyse summary.
  for (const it of analyse?.t7dayList ?? []) {
    const rec = byDay.get(it.happenDay);
    if (rec) {
      if (it.vo2max != null) rec.vo2max = it.vo2max;
      if (it.staminaLevel != null) rec.staminaLevel = it.staminaLevel;
      if (rec.load7d == null && it.t7d != null) rec.load7d = it.t7d;
      if (rec.load28d == null && it.t28d != null) rec.load28d = it.t28d;
      if (rec.loadRatio == null && it.trainingLoadRatio != null) rec.loadRatio = it.trainingLoadRatio;
    }
  }

  // Weekly load history, merged with the low/medium/high intensity split.
  const intensityByWeek = new Map<number, any>();
  for (const it of analyse?.tlIntensity?.detailList ?? []) {
    intensityByWeek.set(it.firstDayOfWeek, it);
  }
  const weekly: WeeklyLoad[] = (analyse?.weekList ?? []).map((w: any) => {
    const intn = intensityByWeek.get(w.firstDayOfWeek);
    return {
      weekStart: w.firstDayOfWeek,
      load: w.trainingLoad ?? 0,
      recMin: w.recomendTlMin ?? null,
      recMax: w.recomendTlMax ?? null,
      low: intn?.periodLowValue ?? null,
      medium: intn?.periodMediumValue ?? null,
      high: intn?.periodHighValue ?? null,
    };
  });

  return {
    daily: [...byDay.values()].sort((a, b) => a.day - b.day),
    weekly: weekly.sort((a, b) => a.weekStart - b.weekStart),
  };
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export const SPORT_NAMES: Record<number, string> = {
  100: "Run",
  101: "Indoor Run",
  102: "Trail Run",
  103: "Track Run",
  104: "Hike",
  105: "Mountain Climb",
  200: "Road Bike",
  201: "Indoor Bike",
  203: "Gravel Bike",
  204: "Mountain Bike",
  300: "Pool Swim",
  301: "Open Water",
  400: "Cardio",
  402: "Strength",
  403: "Yoga",
  900: "Walk",
  9807: "Bike Commute",
};

export interface Activity {
  id: string;
  name: string;
  sportType: number;
  sportName: string;
  startTime: number; // unix seconds
  durationSeconds: number | null;
  distanceMeters: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null; // kcal
  trainingLoad: number | null;
  avgPower: number | null;
  ascent: number | null;
}

function parseActivity(it: any): Activity {
  const sport = it.sportType;
  return {
    id: String(it.labelId ?? ""),
    name: it.name || it.remark || SPORT_NAMES[sport] || `Sport ${sport}`,
    sportType: sport,
    sportName: SPORT_NAMES[sport] || `Sport ${sport}`,
    startTime: it.startTime ?? 0,
    durationSeconds: it.totalTime ?? null,
    distanceMeters: it.distance ?? it.total ?? null,
    avgHr: it.avgHr || null,
    maxHr: it.maxHr || null,
    // COROS reports "calorie" in calories, not kcal — divide by 1000.
    calories: it.calorie != null ? Math.round(it.calorie / 1000) : null,
    trainingLoad: it.trainingLoad ?? null,
    avgPower: it.avgPower || null,
    ascent: it.ascent ?? null,
  };
}

// ---------------------------------------------------------------------------
// Activity detail (laps, HR zones, per-run VO2max) — needs the yfheader header
// ---------------------------------------------------------------------------

export interface ActivityLap {
  index: number;
  avgPaceSec: number | null; // sec/km
  avgHr: number | null;
  avgPower: number | null;
  avgCadence: number | null;
}

export interface ActivityHrZone {
  index: number;
  min: number;
  max: number;
  percent: number;
  seconds: number;
}

export interface ActivityDetail {
  labelId: string;
  name: string;
  sportType: number;
  sportName: string;
  vo2max: number | null; // currentVo2Max — the real per-run VO2max
  aerobicEffect: number | null; // 0-5
  anaerobicEffect: number | null;
  performance: number | null;
  lapSplitMeters: number | null;
  laps: ActivityLap[];
  hrZones: ActivityHrZone[];
  weather: { tempC: number | null; humidity: number | null; icon: string | null } | null;
}

export async function fetchActivityDetail(
  labelId: string,
  sportType: number,
): Promise<ActivityDetail> {
  const auth = await getAuth();
  const url = `${WEB_BASE[auth.region]}/activity/detail/query`;
  const doFetch = async (a: Auth) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
        accessToken: a.accessToken,
        yfheader: JSON.stringify({ userId: a.userId }),
      },
      body: new URLSearchParams({ labelId, sportType: String(sportType), userId: a.userId }),
    }).then((r) => r.json());

  let body = await doFetch(auth);
  if (body?.result && body.result !== "0000") {
    cachedAuth = null;
    body = await doFetch(await getAuth());
  }
  if (body?.result !== "0000") {
    throw new Error(`COROS activity detail error: ${body?.message || "unknown"}`);
  }

  const d = body.data ?? {};
  const s = d.summary ?? {};

  const hrZoneGroup = (d.zoneList ?? []).find((z: any) => z.type === 126) ?? (d.zoneList ?? [])[0];
  const hrZones: ActivityHrZone[] = (hrZoneGroup?.zoneItemList ?? []).map((z: any) => ({
    index: z.zoneIndex,
    min: z.leftScope,
    max: z.rightScope,
    percent: z.percent,
    seconds: z.second,
  }));

  const lapItems = (d.lapList ?? [])[0]?.lapItemList ?? [];
  const laps: ActivityLap[] = lapItems.map((l: any, i: number) => ({
    index: i + 1,
    avgPaceSec: l.avgPace ? Math.round(l.avgPace) : l.adjustedPace || null,
    avgHr: l.avgHr || null,
    avgPower: l.avgPower || null,
    avgCadence: l.avgCadence || null,
  }));

  const w = d.weather;
  const weather =
    w && w.temperature != null
      ? {
          tempC: w.temperature != null ? Math.round(w.temperature / 10) : null,
          humidity: w.humidity != null ? Math.round(w.humidity / 10) : null,
          icon: w.imagePath && w.fileName ? `${w.imagePath}${w.fileName}` : null,
        }
      : null;

  return {
    labelId,
    name: s.name || SPORT_NAMES[sportType] || `Sport ${sportType}`,
    sportType,
    sportName: SPORT_NAMES[sportType] || `Sport ${sportType}`,
    vo2max: s.currentVo2Max || null,
    aerobicEffect: s.aerobicEffect ?? null,
    anaerobicEffect: s.anaerobicEffect ?? null,
    performance: s.performance === -1 ? null : s.performance ?? null,
    lapSplitMeters: d.lapList?.[0]?.lapDistance ?? null,
    laps,
    hrZones,
    weather,
  };
}

export async function fetchActivities(
  startDay: number,
  endDay: number,
  size = 30,
): Promise<Activity[]> {
  const data = await webGet<any>(
    `/activity/query?startDay=${startDay}&endDay=${endDay}&pageNumber=1&size=${size}`,
  );
  const list = data?.dataList ?? data?.list ?? [];
  return list.map(parseActivity);
}

// ---------------------------------------------------------------------------
// Sleep — COROS mobile API with AES-128-CBC login (key from libencrypt-lib.so)
// ---------------------------------------------------------------------------

function mobileEncrypt(plaintext: string, appKey: string): string {
  const key = Buffer.from(appKey, "ascii"); // 16 ascii digits = 16 bytes (AES-128)
  const data = Buffer.from(plaintext, "utf8");
  const xored = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) xored[i] = data[i] ^ key[i % key.length];
  const cipher = crypto.createCipheriv("aes-128-cbc", key, MOBILE_AES_IV);
  cipher.setAutoPadding(true); // PKCS7
  return Buffer.concat([cipher.update(xored), cipher.final()]).toString("base64");
}

async function mobileLogin(auth: Auth): Promise<string> {
  const { email, password } = credentials();
  const appKey = String(
    Math.floor(1e15 + Math.random() * 9e15),
  ); // 16-digit key
  const payload = {
    account: mobileEncrypt(email, appKey) + "\n",
    accountType: 2,
    appKey,
    clientType: 1,
    hasHrCalibrated: 0,
    kbValidity: 0,
    pwd: mobileEncrypt(md5(password), appKey) + "\n",
    region: "310|Europe/Berlin|US",
    skipValidation: false,
  };
  const res = await fetch(`${MOBILE_BASE[auth.region]}/coros/user/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "okhttp/4.12.0",
      "request-time": String(Date.now()),
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (body?.result !== "0000" || !body?.data?.accessToken) {
    throw new Error(`COROS mobile login failed: ${body?.message || res.status}`);
  }
  return body.data.accessToken;
}

export interface SleepNight {
  day: number;
  totalMinutes: number | null;
  deepMinutes: number | null;
  lightMinutes: number | null;
  remMinutes: number | null;
  awakeMinutes: number | null;
  napMinutes: number | null;
  avgHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  quality: number | null;
}

export async function fetchSleep(
  startDay: number,
  endDay: number,
): Promise<SleepNight[]> {
  const auth = await getAuth();
  if (!auth.mobileToken) auth.mobileToken = await mobileLogin(auth);

  const url = `${MOBILE_BASE[auth.region]}/coros/data/statistic/daily`;
  const reqBody = {
    allDeviceSleep: 1,
    dataType: [5],
    dataVersion: 0,
    startTime: startDay,
    endTime: endDay,
    statisticType: 1,
  };

  const doFetch = async (token: string) =>
    fetch(`${url}?accessToken=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accesstoken: token },
      body: JSON.stringify(reqBody),
    }).then((r) => r.json());

  let body = await doFetch(auth.mobileToken);
  if (body?.result === "1019") {
    auth.mobileToken = await mobileLogin(auth);
    body = await doFetch(auth.mobileToken);
  }
  if (body?.result !== "0000") {
    throw new Error(`COROS sleep error: ${body?.message || "unknown"}`);
  }

  const days = body?.data?.statisticData?.dayDataList ?? [];
  return days
    .map((it: any): SleepNight => {
      const sd = it.sleepData ?? {};
      return {
        day: it.happenDay,
        totalMinutes: sd.totalSleepTime ?? null,
        deepMinutes: sd.deepTime ?? null,
        lightMinutes: sd.lightTime ?? null,
        remMinutes: sd.eyeTime ?? null,
        awakeMinutes: sd.wakeTime ?? null,
        napMinutes: sd.shortSleepTime || null,
        avgHr: sd.avgHeartRate ?? null,
        minHr: sd.minHeartRate ?? null,
        maxHr: sd.maxHeartRate ?? null,
        quality: it.performance === -1 ? null : it.performance ?? null,
      };
    })
    .sort((a: SleepNight, b: SleepNight) => a.day - b.day);
}
