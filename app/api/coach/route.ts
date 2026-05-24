import Anthropic from "@anthropic-ai/sdk";
import { getSummary } from "@/lib/data";
import type { Summary } from "@/lib/metrics";
import {
  chooseProvider,
  detectProviders,
  streamClaudeCli,
  streamCodexCli,
  type Provider,
} from "@/lib/coach-providers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = process.env.COACH_MODEL || "claude-sonnet-4-6";

function fmtMin(min: number | null | undefined): string {
  if (min == null) return "n/a";
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

/** Compact, model-friendly snapshot of the athlete's current state. */
function contextBlock(s: Summary): string {
  const r = s.recovery;
  const recent = s.recentActivities
    .slice(0, 6)
    .map((a) => {
      const d = a.startTime ? new Date(a.startTime * 1000).toISOString().slice(0, 10) : "?";
      const km = a.distanceMeters ? (a.distanceMeters / 1000).toFixed(1) + "km" : "";
      const min = a.durationSeconds ? Math.round(a.durationSeconds / 60) + "min" : "";
      return `- ${d} ${a.sportName} ${km} ${min} avgHR ${a.avgHr ?? "?"} load ${a.trainingLoad ?? "?"}`;
    })
    .join("\n");

  const trend = s.trend
    .slice(-14)
    .map(
      (t) =>
        `${t.date}: rec ${t.recovery ?? "-"}, hrv ${t.hrv ?? "-"}, rhr ${t.rhr ?? "-"}, load ${t.load ?? 0}, sleep ${t.sleepHours ?? "-"}h, fitness ${t.fitness ?? "-"}, fatigue ${t.fatigue ?? "-"}, form ${t.freshness ?? "-"}`,
    )
    .join("\n");

  return `CURRENT STATE (generated ${s.generatedAt}):
RECOVERY: ${r.score ?? "n/a"}% (${r.band ?? "n/a"})
  - HRV: ${r.hrv ?? "n/a"} ms (baseline ${r.hrvBaseline ?? "n/a"})
  - Resting HR: ${r.rhr ?? "n/a"} bpm (baseline ${r.rhrBaseline ?? "n/a"})
  - COROS muscular recovery: ${r.corosRecoveryPct ?? "n/a"}% ; full recovery in ${r.fullRecoveryHours ?? "n/a"}h
STRAIN today: ${s.strain.today ?? "n/a"}/21 (7-day avg ${s.strain.weekAvg ?? "n/a"}); training load today ${s.strain.loadToday ?? 0}
SLEEP last night: ${s.sleep ? `${fmtMin(s.sleep.lastNightMinutes)} (need ${fmtMin(s.sleep.needMinutes)}), score ${s.sleep.score?.toFixed(0) ?? "n/a"}%` : "no data"}${
    s.sleep?.stages
      ? `\n  - deep ${fmtMin(s.sleep.stages.deep)}, light ${fmtMin(s.sleep.stages.light)}, REM ${fmtMin(s.sleep.stages.rem)}, awake ${fmtMin(s.sleep.stages.awake)}`
      : ""
  }
FITNESS (CTL-like): ${s.fitness.current ?? "n/a"} (7-day Δ ${s.fitness.trend7d ?? "n/a"}); FATIGUE: ${s.fitness.fatigue ?? "n/a"}; FORM/freshness: ${s.fitness.form ?? "n/a"}
EVOLAB: running fitness ${s.evolab.runningFitness ?? "n/a"} (top ${s.evolab.ranking ?? "?"}%); breakdown — endurance ${s.evolab.endurance ?? "n/a"}, threshold ${s.evolab.threshold ?? "n/a"}, sprint ${s.evolab.sprint ?? "n/a"}, speed ${s.evolab.speed ?? "n/a"}; LTHR ${s.evolab.lthr ?? "n/a"} bpm, threshold pace ${s.evolab.thresholdPaceSec ? Math.floor(s.evolab.thresholdPaceSec / 60) + ":" + String(s.evolab.thresholdPaceSec % 60).padStart(2, "0") + "/km" : "n/a"}, maxHR ${s.evolab.maxHr ?? "n/a"}
LOAD: 7-day ${s.load.load7d ?? "n/a"}, 28-day ${s.load.load28d ?? "n/a"}, acute:chronic ratio ${s.load.ratio?.toFixed(2) ?? "n/a"}; recommended weekly ${s.load.recMin ?? "?"}-${s.load.recMax ?? "?"}

RECENT WORKOUTS:
${recent || "none in range"}

14-DAY TREND:
${trend}`;
}

const SYSTEM = `You are the built-in AI coach inside a WHOOP-style training app that runs on COROS watch data. You are a knowledgeable, encouraging endurance & strength coach with a sports-science grounding.

How to read the metrics:
- RECOVERY (0-100%): how ready the body is today. Green >=67 (push), Yellow 34-66 (moderate), Red <34 (rest/easy). Driven by sleep HRV vs baseline, resting HR vs baseline, and sleep.
- STRAIN (0-21, logarithmic): cardiovascular load today. Match strain to recovery — high strain on a red day digs a hole.
- FITNESS/FATIGUE/FORM mirror CTL/ATL/TSB. Positive form = fresh/tapered, deeply negative form = either detrained (if fitness is also low/falling) or overreached (if fitness is high).
- Rising HRV + steady/low RHR = adapting well. Falling HRV + rising RHR = under-recovered or fighting illness/stress.

Style: concise and specific. Lead with the answer. Reference the user's actual numbers. Give 1-3 concrete, actionable recommendations. Use short paragraphs or tight bullets. Never invent data that isn't in the snapshot — if something is missing, say so. You are not a doctor; flag genuinely concerning patterns but don't diagnose.`;

interface CoachRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  provider?: Provider;
}

/** Single-string prompt for the CLI providers (system + data + conversation). */
function buildCliPrompt(
  s: Summary,
  messages: CoachRequest["messages"],
): string {
  const convo = messages
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");
  return `${SYSTEM}

${contextBlock(s)}

=== CONVERSATION ===
${convo}

Reply as the coach to the latest USER message. Plain text only — no "ASSISTANT:" prefix, no markdown headers.`;
}

// Expose which backends are available so the UI can render a provider toggle.
export async function GET() {
  const detected = detectProviders();
  return Response.json({
    providers: detected,
    available: (Object.keys(detected) as Provider[]).filter((p) => detected[p]),
    default: chooseProvider(undefined, detected),
  });
}

export async function POST(req: Request) {
  let payload: CoachRequest;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }
  const messages = (payload.messages || []).filter((m) => m.content?.trim());
  if (!messages.length) return Response.json({ error: "no messages" }, { status: 400 });

  const detected = detectProviders();
  const provider = chooseProvider(payload.provider, detected);
  if (!provider) {
    return Response.json(
      {
        needKey: true,
        message:
          "No AI backend available. Install the Claude Code CLI or Codex CLI (and stay logged in), or add ANTHROPIC_API_KEY to .env.local.",
      },
      { status: 200 },
    );
  }

  let summary: Summary;
  try {
    summary = await getSummary();
  } catch (e) {
    return Response.json(
      { error: `Could not load COROS data: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Coach-Provider": provider,
  };

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const mc = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system: [
              { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
              { type: "text", text: contextBlock(summary) },
            ] as any,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });
          mc.on("text", (t) => controller.enqueue(encoder.encode(t)));
          await mc.finalMessage();
        } catch (e) {
          controller.enqueue(encoder.encode(`\n\n[coach error: ${(e as Error).message}]`));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers });
  }

  // CLI providers (no API key needed)
  const prompt = buildCliPrompt(summary, messages);
  const stream =
    provider === "claude" ? streamClaudeCli(prompt) : streamCodexCli(prompt);
  return new Response(stream, { headers });
}
