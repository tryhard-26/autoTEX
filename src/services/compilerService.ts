import { CompileRequest, CompileResult } from '../types/compiler';

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok ? ((await res.json()) as T) : null;
}

export class CompilerService {
  public async compile(request: CompileRequest): Promise<CompileResult> {
    const res = await postJson<CompileResult>('/api/compiler/compile', request);
    if (!res) throw new Error('Compilation request failed');
    return res;
  }

  /** Source line -> PDF page and position (PDF points from page top-left). */
  public forwardSync(mainFile: string, file: string, line: number) {
    return postJson<{ page: number; x: number; y: number }>('/api/compiler/synctex/forward', { mainFile, file, line });
  }

  /** PDF point (from page top-left) -> source file and line. */
  public reverseSync(mainFile: string, page: number, x: number, y: number) {
    return postJson<{ file: string; line: number }>('/api/compiler/synctex/reverse', { mainFile, page, x, y });
  }
}

export const compilerService = new CompilerService();
