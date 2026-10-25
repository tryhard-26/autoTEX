import { describe, it, expect, afterEach } from 'bun:test';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zipPath, extractZip, detectMainFile } from '../services/archive';

const ROOT = path.join(process.cwd(), '.archive_test_workspace');

describe('archive', () => {
  afterEach(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  it('round-trips a folder, skipping build artifacts and session data', () => {
    fs.mkdirSync(path.join(ROOT, 'src/figs'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'src/.autotex'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'src/main.tex'), '\\documentclass{article}');
    fs.writeFileSync(path.join(ROOT, 'src/figs/a.png'), new Uint8Array([1, 2, 3]));
    fs.writeFileSync(path.join(ROOT, 'src/main.aux'), 'x');
    fs.writeFileSync(path.join(ROOT, 'src/.autotex/chat.json'), '[]');

    expect(Object.keys(unzipSync(zipPath(path.join(ROOT, 'src')))).sort()).toEqual(['figs/a.png', 'main.tex']);
  });

  it('strips a single top-level folder and detects the main file', () => {
    const zip = zipSync({ 'paper/paper.tex': strToU8('\\documentclass{article}'), 'paper/sec/intro.tex': strToU8('hi') });
    const dest = path.join(ROOT, 'p');
    fs.mkdirSync(dest, { recursive: true });
    const files = extractZip(zip, dest);
    expect(files.sort()).toEqual(['paper.tex', 'sec/intro.tex']);
    expect(detectMainFile(dest, files)).toBe('paper.tex');
  });

  it('extracts into a subfolder and rejects path traversal', () => {
    fs.mkdirSync(ROOT, { recursive: true });
    expect(extractZip(zipSync({ 'a.png': new Uint8Array([1]), 'b.png': new Uint8Array([2]) }), ROOT, 'figures')).toEqual([
      'figures/a.png',
      'figures/b.png',
    ]);
    expect(() => extractZip(zipSync({ '../evil.txt': strToU8('x'), 'ok.txt': strToU8('y') }), ROOT)).toThrow('Unsafe path');
    expect(() => extractZip(zipSync({ '/etc/evil': strToU8('x'), 'ok.txt': strToU8('y') }), ROOT)).toThrow('Unsafe path');
    expect(fs.existsSync(path.join(process.cwd(), 'evil.txt'))).toBe(false);
  });
});
