import { describe, it, expect } from 'bun:test';
import { TEMPLATES } from '../services/templateService';

describe('Inbaked Skills and Templates', () => {
  it('includes research article template with standard academic layout', () => {
    const article = TEMPLATES.find((t) => t.id === 'article');
    expect(article).toBeDefined();
    expect(article?.mainFile).toBe('main.tex');
    expect(article?.files['main.tex']).toContain('\\documentclass[11pt,a4paper]{article}');
    expect(article?.files['main.tex']).toContain('\\usepackage{booktabs}');
    expect(article?.files['references.bib']).toBeDefined();
  });

  it('includes Beamer template adhering strictly to beamer skill hard rules', () => {
    const beamer = TEMPLATES.find((t) => t.id === 'beamer');
    expect(beamer).toBeDefined();
    expect(beamer?.mainFile).toBe('main.tex');
    const content = beamer?.files['main.tex'] || '';

    // Hard Rule 1 & Rule 0: 16:9 and 10pt
    expect(content).toContain('aspectratio=169,10pt');
    // Hard Rule: Madrid theme
    expect(content).toContain('\\usetheme{Madrid}');
    // Hard Rule: Semantic colors
    expect(content).toContain('\\definecolor{positive}');
    expect(content).toContain('\\definecolor{negative}');
    expect(content).toContain('\\definecolor{emphasis}');
    // Hard Rule: No \\pause
    expect(content).not.toContain('\\pause');
  });
});
