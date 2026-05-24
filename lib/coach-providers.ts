/**
 * AI coach backends. Three providers, all server-side:
 *   - "claude": the local Claude Code CLI (`claude -p`)  — uses your existing auth
 *   - "codex":  the local Codex CLI (`codex exec`)        — uses your existing auth
 *   - "anthropic": the Anthropic API (needs ANTHROPIC_API_KEY)
 *
 * The CLI providers need no API key — they reuse whatever you're already
 * logged into on this machine. Each provider returns a stream of plain text.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export type Provider = "claude" | "codex" | "anthropic";

const enc = new TextEncoder();
const TIMEOUT_MS = 120_000;

/** Resolve a CLI binary: env override → known paths → PATH search. */
function resolveBin(name: string, envVar: string, candidates: string[]): string | null {
  const override = process.env[envVar];
  if (override && existsSync(override)) return override;
  for (const c of candidates) if (existsSync(c)) return c;
  for (const dir of (process.env.PATH || "").split(":")) {
    if (!dir) continue;
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export function claudeBin(): string | null {
  return resolveBin("claude", "CLAUDE_CLI_PATH", [
    join(homedir(), ".local/bin/claude"),
    join(homedir(), ".claude/local/claude"),
  ]);
}

export function codexBin(): string | null {
  return resolveBin("codex", "CODEX_CLI_PATH", [join(homedir(), ".local/bin/codex")]);
}

export function detectProviders(): Record<Provider, boolean> {
  return {
    claude: !!claudeBin(),
    codex: !!codexBin(),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  };
}

/** Pick a provider: honour the request if usable, else fall back by priority. */
export function chooseProvider(
  requested: string | undefined,
  detected: Record<Provider, boolean>,
): Provider | null {
  const order: Provider[] = [
    (process.env.COACH_PROVIDER as Provider) || "claude",
    "claude",
    "codex",
    "anthropic",
  ];
  if (requested && detected[requested as Provider]) return requested as Provider;
  for (const p of order) if (detected[p]) return p;
  return null;
}

/** Spawn a child process and stream its stdout as text. */
function spawnStream(
  bin: string,
  args: string[],
  opts: { onClose?: (emit: (text: string) => void) => void; streamStdout?: boolean } = {},
): ReadableStream<Uint8Array> {
  const streamStdout = opts.streamStdout ?? true;
  let childRef: ReturnType<typeof spawn> | null = null;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let stderr = "";
      let closed = false;
      let timer: ReturnType<typeof setTimeout>;

      // Every enqueue/close goes through these guards so a late timer, a child
      // event after disconnect, or a double-close can never throw.
      const emit = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(text));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // stdin = "ignore" (=> /dev/null): codex exec otherwise blocks waiting
      // for stdin EOF even when the prompt is passed as an argument.
      const child = spawn(bin, args, {
        cwd: tmpdir(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      childRef = child; // expose for cancel()

      timer = setTimeout(() => {
        emit("\n\n[coach timed out]");
        child.kill("SIGKILL");
      }, TIMEOUT_MS);

      if (streamStdout) {
        child.stdout.on("data", (d) => {
          if (!closed) controller.enqueue(new Uint8Array(d));
        });
      }
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (e) => {
        emit(`\n[coach error: ${e.message}]`);
        finish();
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        try {
          opts.onClose?.(emit);
        } catch (e) {
          emit(`\n[coach error: ${(e as Error).message}]`);
        }
        if (code && code !== 0 && stderr) emit(`\n[exit ${code}] ${stderr.slice(0, 300)}`);
        finish();
      });
    },
    cancel() {
      // Client disconnected — stop the child so it doesn't run on detached.
      childRef?.kill("SIGKILL");
    },
  });
}

/** Claude Code CLI — text output streams straight to the client. */
export function streamClaudeCli(fullPrompt: string): ReadableStream<Uint8Array> {
  const bin = claudeBin();
  if (!bin) throw new Error("claude CLI not found");
  const args = ["-p", fullPrompt, "--output-format", "text"];
  if (process.env.COACH_CLI_MODEL) args.push("--model", process.env.COACH_CLI_MODEL);
  return spawnStream(bin, args);
}

/**
 * Codex CLI — stdout is noisy agent log, so write the final message to a temp
 * file via `-o` and emit only that on close.
 */
export function streamCodexCli(fullPrompt: string): ReadableStream<Uint8Array> {
  const bin = codexBin();
  if (!bin) throw new Error("codex CLI not found");
  const outFile = join(tmpdir(), `codex-coach-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const args = [
    "exec",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "-C",
    tmpdir(),
    "-o",
    outFile,
  ];
  if (process.env.COACH_CLI_MODEL) args.push("--model", process.env.COACH_CLI_MODEL);
  args.push(fullPrompt);
  return spawnStream(bin, args, {
    streamStdout: false,
    onClose: (emit) => {
      try {
        if (existsSync(outFile)) {
          const text = readFileSync(outFile, "utf8").trim();
          emit(text || "[codex returned no message]");
          rmSync(outFile, { force: true });
        } else {
          emit("[codex produced no output]");
        }
      } catch (e) {
        emit(`[codex read error: ${(e as Error).message}]`);
      }
    },
  });
}
