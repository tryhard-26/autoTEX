export type FileType = 'tex' | 'bib' | 'sty' | 'cls' | 'bst' | 'pdf' | 'image' | 'text' | 'dir';

export interface FileNode {
  name: string;
  path: string; // relative to project root, e.g. "main.tex" or "sections/intro.tex"
  type: 'file' | 'directory';
  fileType: FileType;
  size?: number;
  children?: FileNode[];
  isModified?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  initialContent: string;
  isDirty: boolean;
  fileType: FileType;
  cursor?: { line: number; column: number };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    text: string;
  };
}

export interface ProjectInfo {
  rootPath: string;
  name: string;
  mainFile: string;
  availableFiles: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  template: string;
  mainFile: string;
  fileCount: number;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
}

