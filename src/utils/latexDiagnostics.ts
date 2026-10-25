import { DiagnosticItem } from '../types/compiler';

/**
 * Parses compiler logs (pdflatex, xelatex, tectonic, latexmk) into structured errors and warnings.
 */
export function parseLatexLog(log: string, defaultFile: string = 'main.tex'): {
  errors: DiagnosticItem[];
  warnings: DiagnosticItem[];
} {
  const errors: DiagnosticItem[] = [];
  const warnings: DiagnosticItem[] = [];

  const lines = log.split(/\r?\n/);
  let currentFile = defaultFile;
  const fileStack: string[] = [defaultFile];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // File entry / exit tracking (e.g. `(./sections/intro.tex` or `)`)
    // Simple heuristic for file tracking in standard TeX logs
    const openMatch = line.match(/\((?:\.\/)?([a-zA-Z0-9_\-./]+\.(?:tex|sty|cls|bbl|aux))\b/);
    if (openMatch && openMatch[1]) {
      currentFile = openMatch[1];
      fileStack.push(currentFile);
    }
    if (line.includes(')') && fileStack.length > 1) {
      fileStack.pop();
      currentFile = fileStack[fileStack.length - 1] ?? defaultFile;
    }

    // Pattern 1: `file.tex:123: Error message` or `file.tex:123: error: ...`
    const fileLineMatch = line.match(/^([^:\s]+(?:\.tex|\.sty|\.cls)?):(\d+):\s*(?:error:\s*)?(.*)$/i);
    if (fileLineMatch && fileLineMatch[1] && fileLineMatch[2]) {
      const matchFile = fileLineMatch[1].replace(/^\.\//, '');
      const lineNum = parseInt(fileLineMatch[2], 10);
      const msg = fileLineMatch[3]?.trim() || 'Syntax error';
      
      const isWarn = /warning/i.test(msg);
      const item: DiagnosticItem = {
        type: isWarn ? 'warning' : 'error',
        file: matchFile,
        line: lineNum,
        message: msg,
        raw: line,
      };

      if (isWarn) {
        warnings.push(item);
      } else {
        errors.push(item);
      }
      continue;
    }

    // Pattern 2: `! LaTeX Error: ...` or `! Package ... Error: ...` or `! Undefined control sequence.`
    if (line.startsWith('!')) {
      const errorMsg = line.slice(1).trim();
      let errorLine = 1;
      let snippet = '';

      // Look ahead for `l.<number> <snippet>`
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const nextLine = lines[j] ?? '';
        const lineNumMatch = nextLine.match(/^l\.(\d+)\s*(.*)$/);
        if (lineNumMatch && lineNumMatch[1]) {
          errorLine = parseInt(lineNumMatch[1], 10);
          snippet = lineNumMatch[2]?.trim() ?? '';
          break;
        }
      }

      errors.push({
        type: 'error',
        file: currentFile,
        line: errorLine,
        message: errorMsg,
        codeSnippet: snippet,
        raw: line,
      });
      continue;
    }

    // Pattern 3: `LaTeX Warning: ... on input line 42.`
    const warningMatch = line.match(/LaTeX Warning:\s*(.+?)(?: on input line (\d+))?\./i);
    if (warningMatch && warningMatch[1]) {
      const warnMsg = warningMatch[1].trim();
      const warnLine = warningMatch[2] ? parseInt(warningMatch[2], 10) : 1;
      warnings.push({
        type: 'warning',
        file: currentFile,
        line: warnLine,
        message: warnMsg,
        raw: line,
      });
      continue;
    }

    // Pattern 4: Overfull / Underfull \hbox or \vbox warnings
    const boxMatch = line.match(/(Overfull|Underfull) \\([hv]box) \([^)]+\) (?:in paragraph )?at lines (\d+)(?:--\d+)?/);
    if (boxMatch && boxMatch[1] && boxMatch[3]) {
      warnings.push({
        type: 'warning',
        file: currentFile,
        line: parseInt(boxMatch[3], 10),
        message: `${boxMatch[1]} \\${boxMatch[2]} at line ${boxMatch[3]}`,
        raw: line,
      });
      continue;
    }
  }

  // Deduplicate errors and warnings by file:line:message
  const dedup = (items: DiagnosticItem[]) => {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.file}:${item.line}:${item.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    errors: dedup(errors),
    warnings: dedup(warnings),
  };
}
