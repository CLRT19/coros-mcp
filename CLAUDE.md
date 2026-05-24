# CLAUDE.md — COROS Pulse

Working notes for Claude. Read this first; it captures the non-obvious things
(API quirks, gotchas, conventions) that aren't visible from the code alone.

## What this is

A **recovery / strain / sleep readiness dashboard with a built-in AI coach**, built on the
owner's **COROS** training data. Standalone **Next.js 14 (App Router) + TypeScript
+ Tailwind**. Not Rust — all TS/Node.

The data comes from COROS's **unofficial Training Hub web API** (reverse-engineered).
COROS also ships an official read-only MCP server (`mcpus.coros.com`) for plugging
into Claude/ChatGPT, but this app pulls data directly so it can compute its own
recovery / strain / sleep readiness scores and render a custom UI.

## Run / verify

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (run before claiming "it compiles")
npx tsc --noEmit     # typecheck
npm run coros:check  # smoke-test the COROS client + scoring against live data
```

Screenshots (Chrome is installed) — virtual-time-budget waits for the coach's
live reply before snapping:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --window-size=1440,2700 \
  --virtual-time-budget=95000 --timeout=120000 \
  --screenshot=/tmp/shot.png "http://localhost:3000/"
```

## Architecture / data flow

```
COROS Training Hub API ─► lib/coros.ts   (auth + typed fetchers, web-only)
                          lib/metrics.ts (readiness scoring → Summary)
                          lib/data.ts    (cached loader, 3-min TTL, in-memory)
                               │
                 ┌─────────────┴──────────────┐
        app/api/summary/route.ts       app/api/coach/route.ts
            (Summary JSON)               (LLM, streaming)
                               │
                          app/page.tsx (server component) + components/*
```

- `app/page.tsx` is a server component that calls `getSummary()` directly and
  renders. `RefreshButton`/`TrendChart`/`Coach`/charts are client islands.
- `lib/data.ts` caches the whole `Summary` in-process for 3 min; `?refresh=1`
  on `/api/summary` busts it. Bust it before screenshots after data/scoring edits.

## COROS API — the important gotchas

Base hosts (region from `COROS_REGION`, default `us`):
- Web (Training Hub): `teamapi.coros.com` (us), `teameuapi.coros.com` (eu), `teamcnapi.coros.com` (cn)
- Mobile: `api.coros.com` (us), `apieu`, `apicn`

**Auth**: `POST /account/login` with `{account, accountType:2, pwd: md5(password)}`
→ `data.accessToken` + `data.userId`. Send token as header `accessToken: <token>`.
Success responses have `result: "0000"`; errors return `status:500` or a `result` code.

**⚠️ WEB LOGIN ONLY. Never trigger the mobile login by default.** The mobile API
(`/coros/user/login`, AES-encrypted) shares the **phone's** session — logging in
there **logs the owner out of the COROS app on their phone**. This was an explicit
complaint. The web login is a separate session and is safe. Sleep stages are the
only thing that needs the mobile API, so sleep is gated behind
`COROS_ENABLE_SLEEP` (default **0**). HRV/recovery come from the web dashboard, so
they work web-only.

**Endpoints used** (all web / `teamapi`):
- `/dashboard/query` → `summaryInfo`: `recoveryPct`, `recoveryState`,
  `fullRecoveryHours`, `rhr`, `staminaLevel` (= Running Fitness, 40–100),
  `staminaLevelRanking` (percentile, lower=better → "Top X%"),
  `aerobicEnduranceScore`/`anaerobicCapacityScore`/`anaerobicEnduranceScore`/
  `lactateThresholdCapacityScore` (the four EvoLab breakdown scores, 40–100),
  `lthr`, `ltsp` (sec/km), `fitnessMaxHr`, `ltspZone` (pace zones), `runScoreList`
  (race predictor), `sleepHrvData.sleepHrvList` (last ~7 nights of HRV).
- `/dashboard/detail/query` → `detailList` (last **7 days only**, ignores date
  params) with a `vo2max` field (0 unless there was a recent run test).
- `/analyse/dayDetail/query?startDay&endDay` → `dayList`: `cti` (fitness/CTL),
  `ati` (fatigue/ATL), `tib` (base), `tiredRateNew` (form/freshness), `rhr`,
  `trainingLoad`, `t7d`/`t28d` (7/28-day load), `trainingLoadRatio` (ACWR),
  `recomendTlMin`/`recomendTlMax`.
- `/analyse/query` → `weekList` (12-week load + recommended band), `tlIntensity`
  (weekly low/med/high split), `t7dayList`.
- `/activity/query?startDay&endDay&pageNumber&size` → `dataList` (workouts).
  NB: `calorie` is in **cal, not kcal** (divide by 1000). `isRunTest:1` marks run tests.
- `/activity/detail/query` (POST form) → **gzipped** response. Requires the
  `yfheader: {"userId":...}` header or it returns `result:1001`. Wired via
  `fetchActivityDetail()` → `/api/activity/[id]` → the per-run detail modal
  (laps, HR zones, per-run VO2max, weather).

**Region note**: this account is `us` → `teamapi.coros.com`.

## EvoLab / Running Fitness semantics (verified against the COROS app screenshot)

- **Running Fitness** = `staminaLevel` (40–100, marathon-equivalent). The dial.
  "Stamina" and "Running Fitness" are the SAME field — do not show both (that was
  a real bug).
- **Breakdown** (40–100 each, cluster tightly for balanced runners): Endurance =
  `aerobicEnduranceScore`, Threshold = `lactateThresholdCapacityScore`, Speed =
  `anaerobicEnduranceScore`, Sprint = `anaerobicCapacityScore`. COROS shows pace
  zones per ability, derived from `ltspZone` (Endurance≈z[1]–z[0], Threshold≈z[4]–z[2],
  Speed≈z[5]–z[4], Sprint < z[5]).
- **Basic Metrics**: VO2Max, Threshold Pace (`ltsp`), Threshold HR (`lthr`).
  **VO2max is NOT in `/dashboard/query`.** It only appears in `/dashboard/detail/query`
  `vo2max` (last 7 days) and is 0 unless there was a recent run. The app's persisted
  "52" is a last-known value the web API doesn't expose when the account is dormant.
  Surface VO2max when non-zero, else `—`. **Do not fake it / do not VDOT-estimate it**
  (a Daniels estimate from the 5K predictor gives ~39, inconsistent with COROS's 52).
- **Race Predictor** = `runScoreList`. `type`→distance: 1=Marathon, 2=Half, 4=10K,
  5=5K. `duration`=predicted finish (sec), `avgPace`=sec/km.

## Metric definitions (lib/metrics.ts)

- **Recovery (0–100, green≥67/yellow≥34/red)**: HRV-vs-baseline (50%) + RHR-vs-baseline
  (30%) + sleep performance (20%). Baselines are **trailing 30-day, excluding the
  scored day** (must stay causal — don't revert to a whole-window mean incl. today).
  Headline = the most recent *settled* day (one with an HRV night) so it never reads
  a partial "today"; it equals a point in the trend (`recovery.asOf`).
- **Strain (0–21, log)**: maps daily training load via `loadRef` = interpolated 90th
  percentile of recent nonzero loads.
- **Sleep**: duration vs 480-min need × in-sleep efficiency. Needs mobile API (off
  by default) → usually null in web-only mode.
- **Fitness/Fatigue/Form** = `cti`/`ati`/`tiredRateNew`. `trend7d` is a real
  date-based 7-day delta (not an array offset).

## AI coach (app/api/coach/route.ts, lib/coach-providers.ts)

Three backends, auto-detected; UI shows a toggle. `GET /api/coach` returns which
are available; `POST` streams plain text with header `X-Coach-Provider`.
- **claude**: spawns the local `claude -p ... --output-format text` (real binary
  `~/.local/bin/claude`; the shell `claude` is a function). No API key.
- **codex**: spawns `codex exec --sandbox read-only -C <tmp> -o <file> <prompt>`.
  **Gotcha: stdin MUST be `/dev/null`** (`stdio:["ignore","pipe","pipe"]`) or
  `codex exec` hangs waiting for stdin EOF. stdout is noisy → read the clean answer
  from the `-o` file on close. No API key.
- **anthropic**: Anthropic SDK streaming; needs `ANTHROPIC_API_KEY`. Uses prompt
  caching on the static system prompt.

CLI children run in `tmpdir()` so they don't load this repo's CLAUDE.md/skills.
Every `controller.enqueue`/`close` is guarded (`closed` flag) so a late timeout or
post-disconnect child event can't throw `ERR_INVALID_STATE`.

The owner prefers the **CLI backends over API keys** (reuses existing logins).

## Conventions

- **Web-login only.** Don't add code paths that hit the mobile API without an
  explicit, clearly-warned opt-in.
- Chart/series colors live in **`lib/chartColors.ts`** (`C`) — Recharts can't read
  Tailwind classes. Tailwind tokens in `tailwind.config.ts` mirror them. COROS look:
  warm near-black `ink.*` + brand orange `coros.*` as the dominant accent; recovery
  uses green/yellow/red; keep them in sync.
- Recharts: set `isAnimationActive={false}` (enter animation otherwise leaves paths
  invisible in headless screenshots and feels laggy).
- `.label` (uppercase caption) and `.nums` (tabular figures) utility classes in
  `globals.css`; use them instead of re-spelling the same Tailwind each time.
- COROS dates are `YYYYMMDD` integers (`yyyymmdd()` / `daysAgo()` in coros.ts).

## Security

Credentials live only in **`.env.local`** (gitignored: `.env*.local`). Server-side
only — never sent to the browser. Only `md5(password)` is transmitted, to COROS.
Never commit `.env.local`. Verify with `git status` before every commit.

## Git workflow (owner wants frequent commits to roll back)

- Work on branch **`coros-pulse`** (not `main`).
- Commit **frequently**, one logical change per commit, after it typechecks.
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

## Known limitations / open threads

- VO2max shows `—` while the account is dormant (no recent run test); populates
  from `/dashboard/detail/query` after a run.
- No web endpoint for sleep stages — sleep requires the (phone-logging-out) mobile
  API, so it's off by default.
