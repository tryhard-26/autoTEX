import * as os from 'node:os';
import * as path from 'node:path';
import { AgentToolCall } from '../../src/types/agent';

// opencode (https://opencode.ai) runs the agent: its own tool loop inside the project directory, with
// whatever providers the user logged into (`opencode auth login`). Model ids are "provider/model".

const STALL_MS = 5 * 60_000; // no output from opencode for this long = the model stopped responding
// `instructions` (skill files) are loaded into the model's context on every request; opencode needs
// explicit paths there, globs don't work. The agent is kept inside the project (plus `allowRead` dirs):
// no wandering through autoTEX's own source/logs or the rest of the disk.
const config = (instructions: string[], allowRead: string[]) =>
  JSON.stringify({
    instructions,
    permission: { external_directory: { '*': 'deny', ...Object.fromEntries(allowRead.map((d) => [`${d}/*`, 'allow'])) } },
  });

// opencode runs as a child process; if the server stops, take it down too, otherwise it keeps editing
// the project with nothing left to cancel it. (A SIGKILLed server can't clean up; nothing can.)
const running = new Set<{ kill: () => void }>();
const killAll = () => running.forEach((p) => p.kill());
process.on('exit', killAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    killAll();
    process.exit(128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as const)[sig]);
  });
}

export function opencodeBin(): string | null {
  return process.env.OPENCODE_BIN || Bun.which('opencode') || Bun.which('opencode', { PATH: path.join(os.homedir(), '.bun/bin') });
}

export interface OpencodeModel {
  id: string; // "provider/model"
  contextWindow?: number;
  ownedBy?: string;
  free: boolean;
}

let modelsCache: { at: number; models: OpencodeModel[] } | null = null;

/** Tool-capable models from every provider opencode is logged into, free ones first. Cached for 5 minutes. */
export async function listOpencodeModels(): Promise<OpencodeModel[]> {
  const bin = opencodeBin();
  if (!bin) return [];
  if (modelsCache && Date.now() - modelsCache.at < 5 * 60_000) return modelsCache.models;
  const out = await new Response(Bun.spawn([bin, 'models', '--verbose'], { stdout: 'pipe', stderr: 'ignore' }).stdout).text();
  // Output is "provider/model" on its own line followed by that model's JSON.
  const models: OpencodeModel[] = [];
  for (const block of out.split(/^(?=\S+\/\S+\n\{)/m)) {
    const nl = block.indexOf('\n');
    try {
      const m = JSON.parse(block.slice(nl + 1));
      if (m.status === 'deprecated' || m.capabilities?.toolcall === false) continue;
      const free = !m.cost || (m.cost.input === 0 && m.cost.output === 0);
      models.push({ id: block.slice(0, nl).trim(), contextWindow: m.limit?.context, ownedBy: m.providerID, free });
    } catch {}
  }
  models.sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
  modelsCache = { at: Date.now(), models };
  return models;
}

export interface OpencodeTurn {
  text: string;
  thinking: string;
  totalTokens: number;
  toolCalls: AgentToolCall[];
  sessionId?: string;
}

/**
 * One `opencode run` turn in `dir`, continuing `sessionId` when given. Streams events through the callbacks.
 * File edits happen on disk inside opencode; the caller diffs snapshots to find them.
 */
export async function runOpencode(opts: {
  dir: string;
  model: string;
  prompt: string;
  sessionId?: string;
  instructions?: string[];
  allowRead?: string[];
  signal: AbortSignal;
  onText: (t: string) => void;
  onThinking: (t: string) => void;
  onTool: (call: AgentToolCall) => void;
  onLog: (line: string) => void;
}): Promise<OpencodeTurn> {
  const bin = opencodeBin();
  if (!bin) throw new Error('opencode is not installed (bun add -g opencode-ai)');
  const args = [bin, 'run', '--format', 'json', '--thinking', '--print-logs', '--log-level', 'INFO', '--dir', opts.dir, '-m', opts.model];
  if (opts.sessionId) args.push('--session', opts.sessionId);
  args.push(opts.prompt);

  opts.onLog(`opencode run -m ${opts.model}${opts.sessionId ? ` --session ${opts.sessionId}` : ' (new session)'}`);
  const proc = Bun.spawn(args, { cwd: opts.dir, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, OPENCODE_CONFIG_CONTENT: config(opts.instructions ?? [], opts.allowRead ?? []) } });
  running.add(proc);
  const kill = () => proc.kill();
  opts.signal.addEventListener('abort', kill, { once: true });

  let stalled = false;
  let watchdog: ReturnType<typeof setTimeout>;
  const alive = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      opts.onLog(`No output for ${STALL_MS / 60_000} min; stopping opencode`);
      proc.kill();
    }, STALL_MS);
  };
  alive();

  // opencode's own log (stderr) goes to the agent log, minus timestamps/noise; the last lines explain failures.
  const stderrTail: string[] = [];
  const pumpStderr = (async () => {
    let rest = '';
    for await (const chunk of proc.stderr as unknown as AsyncIterable<Uint8Array>) {
      rest += new TextDecoder().decode(chunk);
      const lines = rest.split('\n');
      rest = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.replace(/^timestamp=\S+ /, '').replace(/ run=\w+/, '').trim();
        if (!line || /level=(DEBUG)|"watcher backend"|project copy refresh|duplicate skill name|loading path=/.test(line)) continue;
        stderrTail.push(line);
        if (stderrTail.length > 5) stderrTail.shift();
        opts.onLog(line.slice(0, 500));
      }
    }
  })();

  const turn: OpencodeTurn = { text: '', thinking: '', totalTokens: 0, toolCalls: [] };
  let error = '';
  const handle = (e: any) => {
    turn.sessionId ??= e.sessionID;
    const p = e.part ?? {};
    if (e.type === 'text' && p.text) {
      const piece = (turn.text ? '\n' : '') + p.text;
      turn.text += piece;
      opts.onText(piece);
    } else if (e.type === 'reasoning' && p.text) {
      turn.thinking += p.text;
      opts.onThinking(p.text);
    } else if (e.type === 'tool_use') {
      opts.onLog(`tool ${p.tool} ${p.state?.status ?? ''} ${JSON.stringify(p.state?.input ?? {}).slice(0, 200)}`);
      const input = p.state?.input ?? {};
      const target = input.filePath ? path.relative(opts.dir, input.filePath) : input.command ?? input.pattern ?? '';
      const call: AgentToolCall = {
        id: p.callID ?? `oc-${turn.toolCalls.length}`,
        name: p.tool ?? 'tool',
        args: input,
        status: p.state?.status === 'error' ? 'failed' : 'completed',
        summary: `${p.tool} ${target}`.trim(),
        output: String(p.state?.output ?? p.state?.error ?? '').slice(0, 4000),
      };
      turn.toolCalls.push(call);
      opts.onTool(call);
    } else if (e.type === 'step_finish') {
      turn.totalTokens += p.tokens?.total ?? 0;
      opts.onLog(`step done (${p.reason}): ${p.tokens?.input ?? '?'} in / ${p.tokens?.output ?? '?'} out tokens`);
    } else if (e.type === 'error') {
      error = e.error?.data?.message ?? e.error?.message ?? 'opencode error';
    }
  };

  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
    alive();
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      try {
        if (line.trim()) handle(JSON.parse(line));
      } catch {}
    }
  }
  const code = await proc.exited;
  running.delete(proc);
  await pumpStderr;
  clearTimeout(watchdog!);
  opts.signal.removeEventListener('abort', kill);
  if (opts.signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
  if (stalled) throw new Error(`opencode: the model sent nothing for ${STALL_MS / 60_000} minutes (free models can be overloaded; try another model or a New conversation to shrink the context)`);
  if (error || code !== 0) throw new Error(`opencode: ${error || stderrTail.at(-1) || `exited with ${code}`}`);
  return turn;
}
