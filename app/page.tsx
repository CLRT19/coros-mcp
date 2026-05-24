import { getSummary } from "@/lib/data";
import type { Summary } from "@/lib/metrics";
import { Gauge, TrendingUp } from "lucide-react";
import RecoveryRing from "@/components/RecoveryRing";
import StrainGauge from "@/components/StrainGauge";
import SleepPanel from "@/components/SleepPanel";
import EvoLabPanel from "@/components/EvoLabPanel";
import LoadPanel from "@/components/LoadPanel";
import TrendChart from "@/components/TrendChart";
import ActivityList from "@/components/ActivityList";
import Coach from "@/components/Coach";
import RefreshButton from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

function ErrorScreen({ message }: { message: string }) {
  const credsIssue = /COROS_EMAIL|login failed|password/i.test(message);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-100">Couldn’t reach COROS</h1>
      <p className="mt-3 text-sm text-slate-400">{message}</p>
      {credsIssue && (
        <div className="mt-6 w-full rounded-xl border border-ink-600 bg-ink-800 p-5 text-left text-sm text-slate-300">
          <p className="font-medium text-slate-100">Set your credentials</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-slate-300">
{`COROS_EMAIL=you@example.com
COROS_PASSWORD=your-password
COROS_REGION=us`}
          </pre>
          <p className="mt-2 text-slate-500">Then restart the dev server.</p>
        </div>
      )}
    </main>
  );
}

function deltaStr(n: number | null) {
  if (n == null) return undefined;
  return `${n > 0 ? "+" : ""}${n} vs 7d ago`;
}

function Stat({ label, value, unit, sub }: { label: string; value: React.ReactNode; unit?: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink-600/50 bg-ink-700/40 px-3.5 py-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="nums text-xl font-bold text-slate-100">{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</h2>;
}

export default async function Page() {
  let summary: Summary;
  try {
    summary = await getSummary();
  } catch (e) {
    return <ErrorScreen message={(e as Error).message} />;
  }

  const { recovery: r, strain, fitness } = summary;
  const generated = new Date(summary.generatedAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const recHrs = r.fullRecoveryHours;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-600/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 items-center rounded-md bg-coros px-2 text-sm font-black tracking-[0.12em] text-ink-900">
            COROS
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-50">Pulse</h1>
            <p className="text-xs text-slate-500">Readiness &amp; Training Hub · {generated}</p>
          </div>
        </div>
        <RefreshButton />
      </header>

      {/* TODAY: recovery / strain / training status */}
      <section className="mt-6">
        <Eyebrow>Today</Eyebrow>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-xl border border-ink-600/60 bg-ink-800 p-5">
            <RecoveryRing score={r.score} band={r.band} />
            {r.asOf && <p className="mt-1 text-[11px] text-slate-600">from {r.asOf}</p>}
            <div className="mt-3 grid w-full grid-cols-2 gap-2">
              <Stat label="HRV" value={r.hrv ?? "–"} unit="ms" sub={r.hrvBaseline ? `base ${Math.round(r.hrvBaseline)}` : undefined} />
              <Stat label="Resting HR" value={r.rhr ?? "–"} unit="bpm" sub={r.rhrBaseline ? `base ${r.rhrBaseline}` : undefined} />
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-ink-600/60 bg-ink-800 p-5">
            <div className="mb-1 flex items-center gap-2">
              <Gauge size={14} className="text-strain" />
              <span className="label">Day Strain</span>
            </div>
            <StrainGauge strain={strain.today} weekAvg={strain.weekAvg} load={strain.loadToday} />
          </div>

          {/* Training Status (EvoLab fitness/fatigue/form) */}
          <div className="rounded-xl border border-ink-600/60 bg-ink-800 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-recovery-high" />
              <span className="label">Training Status</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Base Fitness" value={fitness.current ?? "–"} sub={deltaStr(fitness.trend7d)} />
              <Stat label="Fatigue" value={fitness.fatigue ?? "–"} sub="acute load" />
              <Stat
                label="Form"
                value={fitness.form ?? "–"}
                sub={fitness.form != null ? (fitness.form > 5 ? "fresh" : fitness.form < -20 ? "detrained" : "balanced") : undefined}
              />
              <Stat label="Recovery Time" value={recHrs != null ? recHrs : "–"} unit="h" sub={recHrs === 0 ? "fully recovered" : "to full"} />
            </div>
          </div>
        </div>
      </section>

      {/* DETAIL + COACH */}
      <section className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <EvoLabPanel evolab={summary.evolab} />
          <SleepPanel sleep={summary.sleep} />
          <LoadPanel load={summary.load} />
          <TrendChart trend={summary.trend} />
          <ActivityList activities={summary.recentActivities} />
        </div>

        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
          <div className="h-[560px] lg:h-[calc(100vh-3rem)]">
            <Coach />
          </div>
        </div>
      </section>

      <footer className="mt-8 pb-6 text-center text-xs text-slate-600">
        Unofficial COROS integration · data stays on your machine · not medical advice
      </footer>
    </main>
  );
}
