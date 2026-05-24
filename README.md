# COROS Pulse

A **WHOOP-style fitness dashboard with a built-in AI coach**, powered by your
[COROS](https://coros.com) training data.

COROS already exposes its data to AI through an official, read-only
[MCP server](https://coros.com/stories/coros-metrics/c/mcp-testing) you plug
into Claude Desktop or ChatGPT. **COROS Pulse** goes the other way: a standalone
app that pulls your COROS data directly and turns it into the three numbers
WHOOP made famous — **Recovery**, **Strain**, and **Sleep** — with an AI coach
that reads your live metrics and tells you what to do today.

![dashboard](docs/dashboard.png)

## What it shows

| WHOOP concept | How COROS Pulse computes it |
| --- | --- |
| **Recovery** (0–100%, green/yellow/red) | Sleep **HRV** vs. baseline (50%) + **resting HR** vs. baseline (30%) + **sleep** performance (20%) |
| **Day Strain** (0–21) | Logarithmic map of the day's COROS **training load** |
| **Sleep** | Duration vs. 8h need + deep/REM/light/awake stages |
| **Fitness / Fatigue / Form** | COROS EvoLab **CTI / ATI / freshness** (CTL/ATL/TSB analogues) |
| **Trends** | 90-day charts of recovery, HRV, RHR, strain, fitness & form |
| **AI Coach** | An LLM, given your full live snapshot, answers "what should I do today?" — runs on the **Claude Code CLI**, **Codex CLI**, or the **Anthropic API** (toggle in the UI) |

## How it works

```
COROS Training Hub API  ──►  lib/coros.ts     (auth + endpoints)
                             lib/metrics.ts   (WHOOP-style scoring)
                             lib/data.ts      (cached loader)
                                  │
                   ┌──────────────┴───────────────┐
        app/api/summary/route.ts          app/api/coach/route.ts
            (metrics JSON)                   (Claude, streaming)
                   │                              │
              app/page.tsx  ──►  dashboard + AI coach panel
```

Endpoints used (unofficial, reverse-engineered from the COROS web + mobile apps):

- `POST /account/login` — MD5-hashed password → access token
- `GET /dashboard/query` — recovery state + 7-day nightly HRV
- `GET /analyse/dayDetail/query` — daily fitness/fatigue/load/RHR
- `GET /analyse/query` — VO2max / LTHR / stamina
- `GET /activity/query` — workout list
- `POST /coros/data/statistic/daily` — sleep stages (mobile API, AES login)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your details
npm run dev                  # http://localhost:3000
```

`.env.local`:

```bash
COROS_EMAIL=you@example.com      # your COROS Training Hub login
COROS_PASSWORD=your-password
COROS_REGION=us                  # us | eu | cn
COROS_ENABLE_SLEEP=1             # pull sleep stages via the mobile API

# --- AI coach (optional) ---
COACH_PROVIDER=claude            # claude | codex | anthropic  (default backend)
ANTHROPIC_API_KEY=               # only needed for the "anthropic" provider
```

### AI coach backends

The coach auto-detects what's available on your machine and shows a toggle:

- **Claude Code** — shells out to the local `claude -p` CLI. No API key; reuses
  your existing Claude Code login. (Default.)
- **Codex** — shells out to the local `codex exec` CLI. No API key; reuses your
  Codex login.
- **API** — the Anthropic API directly, streaming token-by-token. Set
  `ANTHROPIC_API_KEY`.

If none are present, the panel explains how to enable one. Override binary paths
with `CLAUDE_CLI_PATH` / `CODEX_CLI_PATH`, and the API model with `COACH_MODEL`.

Verify your COROS connection from the terminal:

```bash
npm run coros:check
```

## Notes & safety

- Credentials live only in `.env.local` (gitignored) and are used **server-side
  only** — they are never sent to the browser. Your data never leaves your machine
  except for the COROS calls and (if enabled) the AI coach calls to Anthropic.
- This uses **unofficial** COROS endpoints; COROS can change them at any time.
- Enabling sleep performs a COROS *mobile* login, which may rotate the token your
  phone app uses. It's best-effort — the rest of the dashboard works regardless.
- Not medical advice.

## License

MIT — see [LICENSE](LICENSE).
