import { describe, it, expect, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Spawned servers must never touch the real projects/ folder or call a real model.
const PROJECTS_DIR = fs.mkdtempSync(`${os.tmpdir()}/autotex-projects-`);
const OPENCODE_BIN = path.join(import.meta.dir, 'fixtures/fake-opencode.sh');
afterAll(() => fs.rmSync(PROJECTS_DIR, { recursive: true, force: true }));

async function startServer(port: number, env: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    env: { ...process.env, PROJECTS_DIR, PORT: `${port}`, OPENCODE_BIN, ...env },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  for (let i = 0; i < 25; i++) {
    if (await fetch(`http://localhost:${port}/api/health`).then((r) => r.ok, () => false)) break;
    await Bun.sleep(100);
  }
  return proc;
}

const chat = (port: number, signal?: AbortSignal) =>
  fetch(`http://localhost:${port}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi', context: { projectTree: ['main.tex'] } }),
    signal,
  });

describe('Agent SSE stream', () => {
  it('streams agent events as server-sent events and logs the turn', async () => {
    const port = 3999;
    const proc = await startServer(port);
    try {
      const res = await chat(port);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const text = await res.text();
      expect(text).toContain('"token":"A"');
      expect(text).toContain('event: tool_finish');
      expect(text).toContain('event: edit_created');
      expect(text).toContain('event: complete');

      const { lines } = await (await fetch(`http://localhost:${port}/api/agent/logs`)).json();
      expect(lines.some((l: any) => l.text.startsWith('Done'))).toBe(true);
    } finally {
      proc.kill();
      await proc.exited;
    }
  }, 15000);

  it('keeps running after the client disconnects and resumes from the last event', async () => {
    const port = 3997;
    const proc = await startServer(port, { FAKE_OPENCODE_DELAY: '1' });
    try {
      // Read the first text event, then drop the connection.
      const ctrl = new AbortController();
      const reader = (await chat(port, ctrl.signal)).body!.getReader();
      let first = '';
      while (!first.includes('"A"')) first += new TextDecoder().decode((await reader.read()).value);
      const seen = Number(/id: (\d+)\nevent: token/.exec(first)![1]);
      ctrl.abort();

      // Resume after the event we saw; the job must finish with B and complete.
      const rest = await (await fetch(`http://localhost:${port}/api/agent/stream?from=${seen + 1}`)).text();
      expect(rest).toContain('"token":"\\nB"');
      expect(rest).toContain('event: complete');
      expect(rest).not.toContain('"token":"A"');
    } finally {
      proc.kill();
      await proc.exited;
    }
  }, 15000);
});
