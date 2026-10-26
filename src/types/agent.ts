import { DiagnosticItem } from './compiler';

export type AgentRole = 'user' | 'assistant' | 'system';

export interface AgentToolCall {
  id: string;
  name: string; // tool name, e.g. read_file, replace_in_file, compile
  args: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: string; // e.g. "Read main.tex" or "Edited main.tex"
  output?: string;
}

export interface AgentFileEdit {
  id: string;
  file: string;
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  diffText: string;
  status: 'pending' | 'accepted' | 'reverted';
  timestamp: number;
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  toolCalls?: AgentToolCall[];
  edits?: AgentFileEdit[];
  isStreaming?: boolean;
  thinking?: string; // model reasoning, streamed separately from the reply
  durationMs?: number;
  totalTokens?: number;
  undone?: boolean; // turn was undone via undo/redo
}

export interface AgentProjectContext {
  activeFile?: string;
  selectedText?: string;
  selectionRange?: { startLine: number; endLine: number };
  cursorLine?: number;
  projectTree: string[];
  recentErrors: DiagnosticItem[];
  compilerStatus?: {
    lastCompiledAt?: number;
    success?: boolean;
  };
}

export interface AgentSkillInfo {
  name: string;
  description: string;
  path: string;
  category: 'latex' | 'beamer' | 'general';
  tokens: number; // SKILL.md size; every skill is sent with every request
}
