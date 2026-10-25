import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveInProject } from '../services/projectManager';

const TEST_DIR = path.join(process.cwd(), '.test_workspace');

describe('Filesystem Operations & Security', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('creates and reads a LaTeX file', () => {
    const filePath = path.join(TEST_DIR, 'main.tex');
    const content = '\\documentclass{article}\\begin{document}Test\\end{document}';
    fs.writeFileSync(filePath, content, 'utf-8');

    expect(fs.existsSync(filePath)).toBe(true);
    const read = fs.readFileSync(filePath, 'utf-8');
    expect(read).toBe(content);
  });

  it('renames a file cleanly', () => {
    const oldPath = path.join(TEST_DIR, 'old.tex');
    const newPath = path.join(TEST_DIR, 'new.tex');
    fs.writeFileSync(oldPath, 'sample content', 'utf-8');

    fs.renameSync(oldPath, newPath);
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.readFileSync(newPath, 'utf-8')).toBe('sample content');
  });

  it('creates nested directories and files', () => {
    const nestedDir = path.join(TEST_DIR, 'sections');
    fs.mkdirSync(nestedDir, { recursive: true });
    const sectionFile = path.join(nestedDir, 'intro.tex');
    fs.writeFileSync(sectionFile, '\\section{Intro}', 'utf-8');

    expect(fs.existsSync(sectionFile)).toBe(true);
  });

  it('prevents path traversal out of workspace', () => {
    expect(resolveInProject(TEST_DIR, '../../etc/passwd')).toBeNull();
    expect(resolveInProject(TEST_DIR, '../.test_workspace-evil/x.tex')).toBeNull();
    expect(resolveInProject(TEST_DIR, '/etc/passwd')).toBeNull();
    expect(resolveInProject(TEST_DIR, 'sections/intro.tex')).toBe(path.join(TEST_DIR, 'sections/intro.tex'));
  });

  it('deletes files and directories recursively', () => {
    const dir = path.join(TEST_DIR, 'sub');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'file.tex');
    fs.writeFileSync(file, 'delete me', 'utf-8');

    fs.rmSync(dir, { recursive: true, force: true });
    expect(fs.existsSync(dir)).toBe(false);
  });
});
