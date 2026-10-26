import * as os from 'node:os';
import * as path from 'node:path';
import { AgentToolCall } from '../../src/types/agent';

// opencode (https://opencode.ai) runs the agent: its own tool loop inside the project directory, with
// whatever providers the user logged into (`opencode auth login`). Model ids are "provider/model".

const STALL_MS = 5 * 60_000; // no output from opencode for this long = the model stopped responding
// Everything here is about tokens: each request resends the system prompt, tool schemas and instructions.
// - A dedicated `autotex` agent replaces opencode's generic coding prompt and drops tools a LaTeX agent
//   never needs (web, subagents, todos, skill catalog): ~17k -> ~3.5k tokens per request before skills.
// - `instructions` (the skill cores) load on every request; opencode needs explicit paths, not globs.
// - compaction.prune drops old tool outputs (earlier file reads) from long sessions.
// The agent is kept inside the project plus `allowRead` dirs (the skills).
const AGENT = 'autotex';
const UNUSED_TOOLS = ['webfetch', 'websearch', 'codesearch', 'task', 'todowrite', 'todoread', 'skill'];
// Script-patching files bypasses the edit tool (so no diff, no exact-match check) and was the main way
// weaker models went off the rails; the prompt asks them not to, this enforces it.
const BASH_DENY = ['perl *', 'python *', 'python3 *', 'sed -i*', 'awk -i*'];
// Session memory: Dynamic Context Pruning dedupes repeated file reads, purges failed tool calls and lets the
// model compress stale history into summaries. Pinned version; its settings are in opencode/dcp.jsonc.
export const DCP_PLUGIN = '@tarquinen/opencode-dcp@3.2.0';
const CONFIG_DIR = path.join(import.meta.dir, '..', '..', 'opencode');

const config = (prompt: string, instructions: string[], allowRead: string[]) =>
  JSON.stringify({
    plugin: process.env.AUTOTEX_DCP === '0' ? [] : [DCP_PLUGIN],
    instructions,
    autoupdate: false,
    compaction: { auto: true, prune: true },
    agent: {
      [AGENT]: {
        mode: 'primary',
        description: 'autoTEX LaTeX agent',
        prompt,
        permission: {
          ...Object.fromEntries(UNUSED_TOOLS.map((t) => [t, 'deny'])),
          bash: { '*': 'allow', ...Object.fromEntries(BASH_DENY.map((c) => [c, 'deny'])) },
        },
      },
    },
    permission: { external_directory: { '*': 'deny', ...Object.fromEntries(allowRead.map((d) => [`${d}/*`, 'allow'])) } },
  });

// Keep the user's global setup out of autoTEX turns: ~/.claude instructions and other tools' skill
// catalogs cost ~9k tokens per request and have nothing to do with LaTeX.
const ENV = {
  OPENCODE_DISABLE_CLAUDE_CODE: '1',
  OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
  OPENCODE_DISABLE_AUTOUPDATE: '1',
  OPENCODE_CONFIG_DIR: CONFIG_DIR, // where the DCP plugin finds dcp.jsonc
};

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

/**
 * Tool inputs as kept in the chat transcript. A write/edit carries whole file contents, which the UI never
 * shows and which made saved transcripts hundreds of KB; long values are cut down.
 */
function slimArgs(input: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}… (${v.length} chars)` : v])
  );
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
  systemPrompt: string;
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
  // --title skips opencode's extra LLM call that names the session.
  const title = opts.prompt.split('Request:\n').pop()!.slice(0, 60).replace(/\s+/g, ' ');
  const args = [bin, 'run', '--format', 'json', '--thinking', '--print-logs', '--log-level', 'INFO', '--dir', opts.dir, '-m', opts.model, '--agent', AGENT, '--title', title || 'autoTEX'];
  if (opts.sessionId) args.push('--session', opts.sessionId);
  args.push(opts.prompt);

  opts.onLog(`opencode run -m ${opts.model}${opts.sessionId ? ` --session ${opts.sessionId}` : ' (new session)'}`);
  const proc = Bun.spawn(args, { cwd: opts.dir, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...ENV, OPENCODE_CONFIG_CONTENT: config(opts.systemPrompt, opts.instructions ?? [], opts.allowRead ?? []) } });
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
        args: slimArgs(input),
        status: p.state?.status === 'error' ? 'failed' : 'completed',
        summary: `${p.tool} ${target}`.trim(),
        output: String(p.state?.output ?? p.state?.error ?? '').slice(0, 1500),
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
