"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import Markdown from "./Markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type Provider = "claude" | "codex" | "anthropic";

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude Code",
  codex: "Codex",
  anthropic: "API",
};

const SUGGESTIONS = [
  "What should today's workout be?",
  "How's my recovery trending this week?",
  "Am I overtraining or detrained right now?",
  "How can I improve my sleep and HRV?",
];

export default function Coach() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needKey, setNeedKey] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const providerRef = useRef<Provider | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Detect available backends, then fire today's briefing.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/coach");
        const data = await res.json();
        const avail: Provider[] = data.available || [];
        setProviders(avail);
        const def: Provider | null = data.default || avail[0] || null;
        setProvider(def);
        providerRef.current = def;
        if (!def) {
          setNeedKey(
            "No AI backend available. Install the Claude Code CLI or Codex CLI (stay logged in), or set ANTHROPIC_API_KEY in .env.local.",
          );
          return;
        }
      } catch {
        /* fall through — send() will surface errors */
      }
      void send(
        "Give me a short readiness briefing for today based on my current recovery, strain, sleep and form.",
        true,
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string, hideUser = false) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history = hideUser ? messages : [...messages, { role: "user" as const, content: trimmed }];
    if (!hideUser) setMessages(history);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: hideUser ? [{ role: "user", content: trimmed }] : history,
          provider: providerRef.current,
        }),
      });

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (data.needKey) {
          setNeedKey(data.message);
          setMessages((m) => m.slice(0, -1));
          return;
        }
        appendToLast(data.error || data.message || "Something went wrong.");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("no stream");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLast(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      appendToLast(`\n\n[error: ${(e as Error).message}]`);
    } finally {
      setBusy(false);
    }
  }

  function appendToLast(chunk: string) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return copy;
    });
  }

  function pick(p: Provider) {
    setProvider(p);
    providerRef.current = p;
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-ink-600/60 bg-ink-800">
      <div className="flex items-center gap-2 border-b border-ink-600/50 px-5 py-3.5">
        <Sparkles size={16} className="text-coros" />
        <span className="text-sm font-semibold text-slate-100">AI Coach</span>
        {providers.length > 0 && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-ink-700 p-0.5">
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => pick(p)}
                disabled={busy}
                title={`Answer using ${PROVIDER_LABEL[p]}`}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                  provider === p ? "bg-coros text-ink-900" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {needKey && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {needKey}
          </div>
        )}
        {messages.length === 0 && !needKey && (
          <p className="text-sm text-slate-500">Analyzing your data…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "whitespace-pre-wrap bg-coros text-ink-900"
                  : "bg-ink-700 text-slate-200"
              }`}
            >
              {m.content ? (
                m.role === "assistant" ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  m.content
                )
              ) : busy && i === messages.length - 1 ? (
                <span className="inline-flex items-center gap-1 py-1">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                </span>
              ) : (
                ""
              )}
            </div>
          </div>
        ))}
      </div>

      {messages.length <= 2 && !needKey && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="rounded-full border border-ink-600 px-3 py-1 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-ink-600/50 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={provider ? `Ask your coach (${PROVIDER_LABEL[provider]})…` : "Ask your coach…"}
          disabled={busy}
          className="flex-1 rounded-xl bg-ink-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-coros/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-coros text-ink-900 transition hover:opacity-90 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
