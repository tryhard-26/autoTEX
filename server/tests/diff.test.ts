import { describe, it, expect } from 'bun:test';
import { computeFileDiff, createAgentFileEdit } from '../../src/utils/diff';

describe('Diff and Agent Edit Calculations', () => {
  it('correctly calculates additions and deletions', () => {
    const oldCode = `\\section{Intro}\nHello world.\n\\section{Method}\nOriginal content.`;
    const newCode = `\\section{Intro}\nHello world.\n\\section{Method}\nUpdated content.\n\\section{Results}\nNew section.`;

    const stats = computeFileDiff('main.tex', oldCode, newCode);
    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBeGreaterThanOrEqual(0);
    expect(stats.diffText).toContain('+Updated content.');
    expect(stats.diffText).toContain('+New section.');
  });

  it('creates structured agent file edit object', () => {
    const oldCode = 'A';
    const newCode = 'B';
    const edit = createAgentFileEdit('chapter1.tex', oldCode, newCode);

    expect(edit.file).toBe('chapter1.tex');
    expect(edit.status).toBe('pending');
    expect(edit.oldContent).toBe(oldCode);
    expect(edit.newContent).toBe(newCode);
    expect(edit.id).toContain('edit-');
  });
});
