import * as path from 'node:path';
import * as fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { AgentMessage, AgentFileEdit, AgentProjectContext, AgentSkillInfo } from '../../src/types/agent';
import { createAgentFileEdit } from '../../src/utils/diff';
import { countTokens } from 'gpt-tokenizer';
import { opencodeBin, runOpencode } from './opencodeRunner';

const DEFAULT_MODEL = process.env.OPENCODE_MODEL || 'opencode/big-pickle';

const BINARY_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.gz', '.zip',
  '.aux', '.log', '.out', '.toc', '.nav', '.snm', '.vrb', '.fls', '.fdb_latexmk', '.bbl', '.blg', '.xdv',
]);
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.build', '.autotex']);
const IGNORED_FILES = new Set(['.DS_Store', 'project.json']); // project.json is app metadata
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

/** Text files in the project, used to diff what the agent changed during a turn. */
export function snapshotProject(root: string, dir = root, out = new Map<string, string>()): Map<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_FILES.has(entry.name) || IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      snapshotProject(root, full, out);
    } else if (entry.isFile() && !BINARY_EXT.has(path.extname(entry.name).toLowerCase())) {
      if (fs.statSync(full).size <= MAX_SNAPSHOT_BYTES) {
        out.set(path.relative(root, full), fs.readFileSync(full, 'utf-8'));
      }
    }
  }
  return out;
}

export function diffSnapshots(before: Map<string, string>, after: Map<string, string>): AgentFileEdit[] {
  const edits: AgentFileEdit[] = [];
  for (const [file, newContent] of after) {
    const oldContent = before.get(file) ?? '';
    if (oldContent !== newContent) edits.push(createAgentFileEdit(file, oldContent, newContent));
  }
  for (const [file, oldContent] of before) {
    if (!after.has(file)) edits.push(createAgentFileEdit(file, oldContent, ''));
  }
  return edits;
}

const COMPILE_CMD: Record<string, (main: string) => string> = {
  tectonic: (m) => `tectonic --keep-logs --synctex ${m}`,
  latexmk: (m) => `latexmk -pdf -interaction=nonstopmode -synctex=1 ${m}`,
};

const SESSION_DIR = '.autotex';
// Every SKILL.md rides along with every request, so their combined size is a fixed per-request cost.
// Over budget, autoTEX still loads them all (skills are always read) but warns in the agent log.
const SKILLS_TOKEN_BUDGET = Number(process.env.SKILLS_TOKEN_BUDGET) || 6000;

export interface AgentOptions {
  model?: string; // opencode "provider/model"; defaults to OPENCODE_MODEL
}

/**
 * The agent: one opencode turn per message, run inside the project folder. opencode keeps the conversation
 * (its session id is stored per project); autoTEX keeps the chat transcript and diffs the files it changed.
 */
export class AgentRunner extends EventEmitter {
  private projectRoot: string;
  private appRoot: string;
  private model: string;
  private abort: AbortController | null = null;
  private skills: AgentSkillInfo[] = [];

  constructor(projectRoot: string, appRoot: string = process.cwd(), model: string = DEFAULT_MODEL) {
    super();
    this.projectRoot = projectRoot;
    this.appRoot = appRoot;
    this.model = model;
    this.loadSkills();
  }

  public setProjectRoot(newRoot: string) {
    this.projectRoot = newRoot;
  }

  // ---- Session memory: chat transcript + opencode session id per project ----

  private sessionFile(name: 'chat' | 'opencode') {
    return path.join(this.projectRoot, SESSION_DIR, name === 'chat' ? 'chat.json' : 'opencode-session.json');
  }

  public readChat(): unknown[] {
    try {
      return JSON.parse(fs.readFileSync(this.sessionFile('chat'), 'utf-8'));
    } catch {
      return [];
    }
  }

  /**
   * Save the chat transcript. If the new list would drop any stored message, the stored transcript is
   * archived first, so a stale or empty client can never erase history.
   */
  public writeChat(messages: unknown[]) {
    const file = this.sessionFile('chat');
    const ids = (list: unknown[]) => new Set(list.map((m: any) => m?.id));
    const stored = this.readChat();
    const incoming = ids(messages);
    if (stored.some((m: any) => !incoming.has(m?.id))) this.archive([file]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(messages));
  }

  /** Move files into .autotex/sessions/<timestamp>/. */
  private archive(files: string[]) {
    const existing = files.filter((f) => fs.existsSync(f));
    if (existing.length === 0) return;
    const dest = path.join(this.projectRoot, SESSION_DIR, 'sessions', `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of existing) fs.renameSync(f, path.join(dest, path.basename(f)));
  }

  public getModel(): string {
    return this.model;
  }

  public isAvailable(): boolean {
    return !!opencodeBin();
  }

  /** Manual, user-confirmed deletion of all saved conversations for this project (active + archived). */
  public deleteStoredSessions() {
    fs.rmSync(path.join(this.projectRoot, SESSION_DIR), { recursive: true, force: true });
  }

  /** Start a fresh conversation; the previous one is archived, not deleted. */
  public resetConversation() {
    this.archive([this.sessionFile('chat'), this.sessionFile('opencode')]);
  }

  public cancel() {
    this.abort?.abort();
  }

  /** Skills (style guides) in skills/<name>/SKILL.md. Every one is loaded into every agent turn. */
  public loadSkills(): AgentSkillInfo[] {
    const dir = path.join(this.appRoot, 'skills');
    this.skills = [];
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const skillPath = path.join(dir, name, 'SKILL.md');
        if (!fs.existsSync(skillPath)) continue;
        const text = fs.readFileSync(skillPath, 'utf-8');
        const description = text.slice(0, 2000).match(/^description:\s*[|>]?\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '') ?? '';
        // Token counts use OpenAI's o200k encoding; other models' tokenizers differ by roughly ±20%.
        const tokens = countTokens(text);
        this.skills.push({ name, description, path: skillPath, category: name.includes('beamer') ? 'beamer' : 'latex', tokens });
      }
    }
    const total = this.skillTokens();
    if (total > SKILLS_TOKEN_BUDGET) {
      const sizes = this.skills.map((s) => `${s.name} ${s.tokens}`).join(', ');
      this.emit('log', `Skills use ~${total} tokens per request, over the ${SKILLS_TOKEN_BUDGET} budget (${sizes}). Move long material into reference files.`);
    }
    return this.skills;
  }

  public skillTokens(): number {
    return this.skills.reduce((n, s) => n + s.tokens, 0);
  }

  public getSkills(): AgentSkillInfo[] {
    return this.skills;
  }

  /** System prompt for the autotex agent. Static per project and engine, so providers can cache it. */
  public systemPrompt(mainFile: string, engine = 'tectonic'): string {
    const cmd = (COMPILE_CMD[engine] ?? ((m: string) => `${engine} -interaction=nonstopmode -synctex=1 ${m}`))(mainFile);
    return [
      'You are the agent inside autoTEX, a LaTeX editor. You work on one LaTeX project in the current folder.',
      '- Read a file before editing it. Make targeted edits with the edit tool; use write only for new files or full rewrites. Never patch files with python or sed scripts.',
      `- After changing .tex or .bib files, compile with: ${cmd}`,
      `  Fix every error and every Overfull/Underfull \\hbox/\\vbox warning (check the output and ${mainFile.replace(/\.tex$/, '.log')}). Repeat until it compiles cleanly; never stop at a broken build.`,
      ...(this.skills.length
        ? [`- Follow the skills in your instructions. Their longer reference files, read only when the task needs one: ${this.skills.map((s) => path.dirname(s.path)).join(', ')}`]
        : []),
      '- Stay inside the project folder.',
      '- Keep replies short: say what you changed or answer the question. Never paste whole files.',
    ].join('\n');
  }

  /** The per-turn message: targeted context (never the whole project) and the request. */
  public buildPrompt(prompt: string, context: AgentProjectContext, mainFile: string, newSession = true): string {
    const lines = [`Main file: ${mainFile}`];
    // The file list only matters to orient a new session; after that the agent can list files itself.
    if (newSession) lines.push(`Project files: ${context.projectTree.join(', ') || '(none)'}`);
    if (context.activeFile) lines.push(`Open file: ${context.activeFile}${context.cursorLine ? ` (cursor at line ${context.cursorLine})` : ''}`);
    if (context.selectedText) {
      const r = context.selectionRange;
      lines.push(`Selected text${r ? ` (${context.activeFile} lines ${r.startLine}-${r.endLine})` : ''}:`, '```latex', context.selectedText, '```');
    }
    if (context.recentErrors.length > 0) {
      lines.push('Last compile errors:', ...context.recentErrors.slice(0, 20).map((e) => `- ${e.file}:${e.line}: ${e.message}`));
    }
    lines.push('', 'Request:', prompt);
    return lines.join('\n');
  }

  public async sendMessage(
    prompt: string,
    context: AgentProjectContext,
    mainFile = 'main.tex',
    engine = 'tectonic',
    options: AgentOptions = {}
  ): Promise<AgentMessage> {
    if (!this.isAvailable()) throw new Error('opencode is not installed. Run: bun add -g opencode-ai');
    if (this.abort) throw new Error('The agent is already running a request.');

    const model = options.model || this.model;
    const startTime = Date.now();
    this.emit('log', `Turn started with ${model}`);
    this.loadSkills(); // pick up skills added or edited since the last turn without a restart
    const before = snapshotProject(this.projectRoot);
    this.abort = new AbortController();

    const sessionFile = this.sessionFile('opencode');
    let sessionId: string | undefined;
    try {
      sessionId = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')).id;
    } catch {}

    const message = this.buildPrompt(prompt, context, mainFile, !sessionId);
    const system = this.systemPrompt(mainFile, engine);
    this.emit(
      'log',
      `autoTEX context: message ~${countTokens(message)} + system prompt ~${countTokens(system)} + skills ~${this.skillTokens()} tokens (plus opencode's own prompt and tools)`
    );
    let turn: Awaited<ReturnType<typeof runOpencode>>;
    try {
      turn = await runOpencode({
        dir: this.projectRoot,
        model,
        prompt: message,
        systemPrompt: system,
        sessionId,
        instructions: this.skills.map((s) => s.path), // skill cores: always in context, every request
        allowRead: this.skills.map((s) => path.dirname(s.path)),
        signal: this.abort.signal,
        onText: (t) => this.emit('token', t),
        onThinking: (t) => this.emit('thinking', t),
        onLog: (line) => this.emit('log', line),
        onTool: (call) => {
          this.emit('tool_start', call);
          this.emit('tool_finish', call);
        },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Cancelled');
      throw err;
    } finally {
      this.abort = null;
    }
    if (turn.sessionId && turn.sessionId !== sessionId) {
      fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
      fs.writeFileSync(sessionFile, JSON.stringify({ id: turn.sessionId, model }));
    }

    // Edits are whatever actually changed on disk, independent of what the model claims.
    const edits = diffSnapshots(before, snapshotProject(this.projectRoot));
    for (const edit of edits) this.emit('edit_created', edit);

    return {
      id: `msg-${startTime}`,
      role: 'assistant',
      content: turn.text.trim(),
      thinking: turn.thinking.trim() || undefined,
      timestamp: startTime,
      durationMs: Date.now() - startTime,
      totalTokens: turn.totalTokens,
      toolCalls: turn.toolCalls,
      edits,
    };
  }
}
