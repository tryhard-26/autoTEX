export type CompilerEngine = 'tectonic' | 'pdflatex' | 'xelatex' | 'lualatex' | 'latexmk';

export interface DiagnosticItem {
  type: 'error' | 'warning';
  file: string;
  line: number;
  message: string;
  codeSnippet?: string;
  raw?: string;
}

export interface CompileRequest {
  mainFile: string;
  engine?: CompilerEngine;
  synctex?: boolean;
}

export interface CompileResult {
  success: boolean;
  pdfUrl: string | null;
  pdfPath?: string;
  log: string;
  errors: DiagnosticItem[];
  warnings: DiagnosticItem[];
  executionTimeMs: number;
  timestamp: number;
}

export interface SyncTexQuery {
  file: string;
  line: number;
  column?: number;
}

export interface SyncTexResult {
  page: number;
  x: number; // pt or percentage
  y: number;
  width?: number;
  height?: number;
}

export interface ReverseSyncTexQuery {
  page: number;
  x: number;
  y: number;
}

export interface ReverseSyncTexResult {
  file: string;
  line: number;
  column: number;
}
