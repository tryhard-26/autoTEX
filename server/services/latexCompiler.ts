import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import { CompilerEngine, CompileRequest, CompileResult } from '../../src/types/compiler';
import { parseLatexLog } from '../../src/utils/latexDiagnostics';

// Installed engines don't change while the server runs; detect once.
let enginesCache: Promise<CompilerEngine[]> | null = null;

export class LatexCompiler {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public setProjectRoot(newRoot: string) {
    this.projectRoot = newRoot;
  }

  /**
   * Detect which compiler engines are available on the system.
   */
  public detectAvailableEngines(): Promise<CompilerEngine[]> {
    return (enginesCache ??= this.findEngines());
  }

  private async findEngines(): Promise<CompilerEngine[]> {
    const engines: CompilerEngine[] = ['tectonic', 'pdflatex', 'xelatex', 'lualatex', 'latexmk'];
    const searchDirs = ['/opt/homebrew/bin', '/Library/TeX/texbin', '/usr/local/bin', '/usr/bin'];
    const available: CompilerEngine[] = [];

    for (const engine of engines) {
      const foundDirectly = searchDirs.some((d) => fs.existsSync(path.join(d, engine)));
      if (foundDirectly) {
        available.push(engine);
        continue;
      }

      try {
        const proc = spawn('which', [engine], {
          env: {
            ...process.env,
            PATH: `${process.env.PATH || ''}:/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin`,
          },
        });
        const code = await new Promise<number>((resolve) => {
          proc.on('close', resolve);
          proc.on('error', () => resolve(1));
        });
        if (code === 0) {
          available.push(engine);
        }
      } catch {
        // ignore
      }
    }

    return available;
  }

  /**
   * Compiles the LaTeX document.
   */
  public async compile(request: CompileRequest): Promise<CompileResult> {
    const startTime = Date.now();
    const mainFile = request.mainFile;
    const absMainFile = path.isAbsolute(mainFile)
      ? mainFile
      : path.join(this.projectRoot, mainFile);

    if (!fs.existsSync(absMainFile)) {
      return {
        success: false,
        pdfUrl: null,
        log: `Error: File not found: ${mainFile}`,
        errors: [{
          type: 'error',
          file: mainFile,
          line: 1,
          message: `File not found: ${mainFile}`,
        }],
        warnings: [],
        executionTimeMs: 0,
        timestamp: startTime,
      };
    }

    const available = await this.detectAvailableEngines();
    let engine: CompilerEngine = request.engine || 'tectonic';

    // If requested engine not available, pick first available or default to tectonic
    if (!available.includes(engine)) {
      if (available.length > 0) {
        engine = available[0]!;
      }
    }

    const outDir = path.dirname(absMainFile);
    const fileStem = path.basename(absMainFile, path.extname(absMainFile));
    const expectedPdf = path.join(outDir, `${fileStem}.pdf`);

    let cmd: string = engine;
    const searchDirs = ['/opt/homebrew/bin', '/Library/TeX/texbin', '/usr/local/bin', '/usr/bin'];
    for (const d of searchDirs) {
      const candidate = path.join(d, engine);
      if (fs.existsSync(candidate)) {
        cmd = candidate;
        break;
      }
    }

    let args: string[] = [];

    if (engine === 'tectonic') {
      args = ['--synctex', '--outdir', outDir, absMainFile];
    } else if (engine === 'latexmk') {
      args = ['-pdf', '-synctex=1', '-interaction=nonstopmode', `-outdir=${outDir}`, absMainFile];
    } else {
      // pdflatex / xelatex / lualatex
      args = [
        '-synctex=1',
        '-interaction=nonstopmode',
        '-file-line-error',
        `-output-directory=${outDir}`,
        absMainFile,
      ];
    }

    return new Promise<CompileResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let isResolved = false;

      const proc = spawn(cmd, args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          PATH: `${process.env.PATH || ''}:/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin`,
        },
      });

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          try {
            proc.kill('SIGTERM');
          } catch {}
          resolve({
            success: false,
            pdfUrl: null,
            log: 'Compilation timed out after 5 min',
            errors: [{
              type: 'error',
              file: mainFile,
              line: 1,
              message: 'Compilation timed out',
            }],
            warnings: [],
            executionTimeMs: Date.now() - startTime,
            timestamp: startTime,
          });
        }
      }, 5 * 60 * 1000); // first tectonic runs download packages

      proc.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (isResolved) return;
        isResolved = true;
        const totalLog = `${stdout}\n${stderr}\nProcess error: ${err.message}`;
        resolve({
          success: false,
          pdfUrl: null,
          log: totalLog,
          errors: [{
            type: 'error',
            file: mainFile,
            line: 1,
            message: `Failed to execute ${engine}: ${err.message}`,
            raw: err.message,
          }],
          warnings: [],
          executionTimeMs: Date.now() - startTime,
          timestamp: startTime,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isResolved) return;
        isResolved = true;
        const fullLog = `${stdout}\n${stderr}`.trim();
        const diagnostics = parseLatexLog(fullLog, path.basename(mainFile));

        const pdfExists = fs.existsSync(expectedPdf);
        const success = (code === 0 || pdfExists) && diagnostics.errors.length === 0;

        resolve({
          success,
          pdfUrl: pdfExists ? `/api/compiler/pdf?file=${encodeURIComponent(path.relative(this.projectRoot, absMainFile))}&t=${Date.now()}` : null,
          pdfPath: pdfExists ? expectedPdf : undefined,
          log: fullLog,
          errors: diagnostics.errors,
          warnings: diagnostics.warnings,
          executionTimeMs: Date.now() - startTime,
          timestamp: startTime,
        });
      });
    });
  }
}
