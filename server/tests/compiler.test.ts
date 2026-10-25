import { describe, it, expect } from 'bun:test';
import { parseLatexLog } from '../../src/utils/latexDiagnostics';
import { LatexCompiler } from '../services/latexCompiler';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('LaTeX Diagnostic Parser & Compilation', () => {
  it('parses file-line-error format correctly', () => {
    const log = `
This is XeTeX, Version 3.141592653
entering extended mode
main.tex:42: Undefined control sequence.
<recently read> \\invaliddrop
l.42 \\invaliddrop
    `;

    const { errors, warnings } = parseLatexLog(log, 'main.tex');
    expect(errors.length).toBe(1);
    expect(errors[0]?.file).toBe('main.tex');
    expect(errors[0]?.line).toBe(42);
    expect(errors[0]?.message).toContain('Undefined control sequence');
  });

  it('parses classic exclamation mark LaTeX errors', () => {
    const log = `
(./chapter1.tex
! LaTeX Error: Environment align undefined.

See the LaTeX manual or LaTeX Companion for explanation.
Type  H <return>  for immediate help.
 ...                                              
                                                  
l.15 \\begin{align}
                   
)
    `;

    const { errors } = parseLatexLog(log, 'main.tex');
    expect(errors.length).toBe(1);
    expect(errors[0]?.line).toBe(15);
    expect(errors[0]?.message).toContain('Environment align undefined');
  });

  it('parses LaTeX warnings and overfull hbox', () => {
    const log = `
LaTeX Warning: Reference 'sec:results' on page 3 undefined on input line 88.
Overfull \\hbox (14.234pt too wide) in paragraph at lines 102--105
    `;

    const { warnings } = parseLatexLog(log, 'main.tex');
    expect(warnings.length).toBe(2);
    expect(warnings[0]?.line).toBe(88);
    expect(warnings[0]?.message).toContain("Reference 'sec:results'");
    expect(warnings[1]?.line).toBe(102);
    expect(warnings[1]?.message).toContain('Overfull \\hbox');
  });

  it('compiles a real LaTeX file to PDF using tectonic', async () => {
    const testDir = path.join(process.cwd(), '.compiler_test');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const texFile = path.join(testDir, 'sample.tex');
    fs.writeFileSync(
      texFile,
      `\\documentclass{article}
\\begin{document}
\\section{Hello AutoTEX}
This is a test of the local compilation harness.
\\end{document}
`,
      'utf-8'
    );

    const compiler = new LatexCompiler(testDir);
    const result = await compiler.compile({ mainFile: 'sample.tex', engine: 'tectonic' });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.pdfUrl).not.toBeNull();

    const expectedPdf = path.join(testDir, 'sample.pdf');
    expect(fs.existsSync(expectedPdf)).toBe(true);

    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  }, 180000); // first tectonic run may download bundle files
});
