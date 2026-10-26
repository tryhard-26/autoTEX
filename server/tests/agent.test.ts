import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AgentRunner, snapshotProject, diffSnapshots } from '../services/agentRunner';
import * as path from 'node:path';
import * as fs from 'node:fs';

const TEST_ROOT = path.join(process.cwd(), '.agent_test_workspace');

describe('Agent runner', () => {
  beforeEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(TEST_ROOT, 'sections'), { recursive: true });
    fs.writeFileSync(path.join(TEST_ROOT, 'main.tex'), '\\documentclass{beamer}\nA\n');
    fs.writeFileSync(path.join(TEST_ROOT, 'sections/intro.tex'), 'intro\nintro\n');
    fs.writeFileSync(path.join(TEST_ROOT, 'main.pdf'), '%PDF binary');
  });

  afterEach(() => fs.rmSync(TEST_ROOT, { recursive: true, force: true }));

  it('loads skills from skills/ and counts their tokens', () => {
    const runner = new AgentRunner(TEST_ROOT);
    const names = runner.getSkills().map((s) => s.name);
    expect(names).toContain('latex');
    expect(runner.getSkills().every((s) => s.tokens > 100)).toBe(true);
    expect(runner.skillTokens()).toBeLessThan(6000); // the built-in skills stay within the default budget
    expect(names).toContain('beamer');
  });

  it('diffs project snapshots into edits (modified, created, deleted), ignoring build output', () => {
    const before = snapshotProject(TEST_ROOT);
    expect(before.has('main.pdf')).toBe(false);

    fs.writeFileSync(path.join(TEST_ROOT, 'main.tex'), '\\documentclass{beamer}\nB\n');
    fs.writeFileSync(path.join(TEST_ROOT, 'refs.bib'), '@misc{x}\n');
    fs.rmSync(path.join(TEST_ROOT, 'sections/intro.tex'));

    const edits = diffSnapshots(before, snapshotProject(TEST_ROOT));
    const byFile = Object.fromEntries(edits.map((e) => [e.file, e]));
    expect(Object.keys(byFile).sort()).toEqual(['main.tex', 'refs.bib', 'sections/intro.tex']);
    expect(byFile['main.tex']).toMatchObject({ additions: 1, deletions: 1 });
    expect(byFile['sections/intro.tex']!.newContent).toBe('');
  });

  it('builds targeted context with selection, errors and the matching skill', () => {
    const prompt = new AgentRunner(TEST_ROOT).buildPrompt(
      'Rewrite using aligned equations',
      {
        activeFile: 'main.tex',
        cursorLine: 2,
        selectedText: 'a = b',
        selectionRange: { startLine: 2, endLine: 2 },
        projectTree: ['main.tex'],
        recentErrors: [{ type: 'error', file: 'main.tex', line: 2, message: 'Undefined control sequence' }],
      },
      'main.tex'
    );
    expect(prompt).toContain('a = b');
    expect(prompt).toContain('main.tex:2: Undefined control sequence');
    expect(prompt).toContain('Project files: main.tex'); // new session: orient with the file list
    expect(new AgentRunner(TEST_ROOT).buildPrompt('x', { projectTree: ['main.tex'], recentErrors: [] }, 'main.tex', false)).not.toContain(
      'Project files'
    ); // continuing session: no file list

    const system = new AgentRunner(TEST_ROOT).systemPrompt('main.tex', 'tectonic');
    expect(system).toContain('tectonic --keep-logs --synctex main.tex'); // compile-and-fix loop
    expect(system).toContain('skills/beamer'); // where the on-demand reference files are
  });

  it('session memory is never deleted: a new conversation archives the old one', () => {
    const runner = new AgentRunner(TEST_ROOT);
    runner.writeChat([{ id: 'm1', role: 'user', content: 'hello' }]);
    expect(runner.readChat()).toHaveLength(1);

    runner.resetConversation();
    expect(runner.readChat()).toHaveLength(0); // fresh active conversation...
    const sessions = path.join(TEST_ROOT, '.autotex', 'sessions');
    const [archived] = fs.readdirSync(sessions);
    expect(JSON.parse(fs.readFileSync(path.join(sessions, archived!, 'chat.json'), 'utf-8'))[0].content).toBe('hello'); // ...old one kept

    // Reloading the project (e.g. server restart) restores the active conversation from disk.
    runner.writeChat([{ id: 'm2', role: 'user', content: 'again' }]);
    expect(new AgentRunner(TEST_ROOT).readChat()).toHaveLength(1);
  });

  it('saving a transcript that drops messages archives the stored one first', () => {
    const runner = new AgentRunner(TEST_ROOT);
    runner.writeChat([{ id: 'a' }, { id: 'b' }]);
    runner.writeChat([{ id: 'a' }, { id: 'b' }, { id: 'c' }]); // append: no archive
    runner.writeChat([]); // stale/empty client
    const sessions = path.join(TEST_ROOT, '.autotex', 'sessions');
    const archived = fs.readdirSync(sessions).map((d) => JSON.parse(fs.readFileSync(path.join(sessions, d, 'chat.json'), 'utf-8')));
    expect(archived).toEqual([[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
  });

  it('manual delete removes active and archived conversations', () => {
    const runner = new AgentRunner(TEST_ROOT);
    runner.writeChat([{ id: 'a' }]);
    runner.resetConversation(); // archives
    runner.writeChat([{ id: 'b' }]);
    runner.deleteStoredSessions();
    expect(fs.existsSync(path.join(TEST_ROOT, '.autotex'))).toBe(false);
    expect(runner.readChat()).toEqual([]);
  });

  it('runs a turn through opencode: streams text and tools, detects edits, keeps the session', async () => {
    process.env.OPENCODE_BIN = path.join(import.meta.dir, 'fixtures/fake-opencode.sh');
    const configOut = path.join(TEST_ROOT, '..', '.agent_test_config.json');
    process.env.FAKE_OPENCODE_CONFIG_OUT = configOut;
    const runner = new AgentRunner(TEST_ROOT);
    const tokens: string[] = [];
    runner.on('token', (t) => tokens.push(t));

    const msg = await runner.sendMessage('edit it', { projectTree: ['main.tex'], recentErrors: [] });
    expect(tokens.join('')).toBe('A\nB');
    expect(msg.toolCalls?.[0]).toMatchObject({ name: 'edit', status: 'completed' });
    expect(msg.totalTokens).toBe(42);
    // Every skill is passed to opencode as always-loaded instructions.
    const config = JSON.parse(fs.readFileSync(configOut, 'utf-8'));
    fs.rmSync(configOut);
    expect(config.instructions.map((p: string) => path.relative(process.cwd(), p)).sort()).toEqual(['skills/beamer/SKILL.md', 'skills/latex/SKILL.md']);
    // Lean dedicated agent: own prompt, no web/subagent/skill-catalog tools, old tool output pruned.
    expect(config.agent.autotex.prompt).toContain('autoTEX');
    expect(config.agent.autotex.permission).toMatchObject({ webfetch: 'deny', task: 'deny', skill: 'deny' });
    expect(config.compaction.prune).toBe(true);
    expect(msg.edits?.map((e) => e.file)).toEqual(['main.tex']);
    const session = path.join(TEST_ROOT, '.autotex', 'opencode-session.json');
    expect(JSON.parse(fs.readFileSync(session, 'utf-8')).id).toBe('ses_fake');

    runner.resetConversation(); // next turn starts a new opencode session; the old pointer is archived
    expect(fs.existsSync(session)).toBe(false);
    delete process.env.OPENCODE_BIN;
    delete process.env.FAKE_OPENCODE_CONFIG_OUT;
  });
});
