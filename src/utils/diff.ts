import * as Diff from 'diff';
import { AgentFileEdit } from '../types/agent';

export interface DiffStats {
  additions: number;
  deletions: number;
  diffText: string;
}

export function computeFileDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): DiffStats {
  const changes = Diff.diffLines(oldContent, newContent);
  let additions = 0;
  let deletions = 0;

  for (const part of changes) {
    const lineCount = part.count ?? (part.value ? part.value.split('\n').length - 1 : 0);
    if (part.added) {
      additions += lineCount;
    } else if (part.removed) {
      deletions += lineCount;
    }
  }

  const patch = Diff.createPatch(filePath, oldContent, newContent, 'Original', 'Agent Edit');

  return {
    additions,
    deletions,
    diffText: patch,
  };
}

export function createAgentFileEdit(
  filePath: string,
  oldContent: string,
  newContent: string
): AgentFileEdit {
  const stats = computeFileDiff(filePath, oldContent, newContent);
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file: filePath,
    additions: stats.additions,
    deletions: stats.deletions,
    oldContent,
    newContent,
    diffText: stats.diffText,
    status: 'pending',
    timestamp: Date.now(),
  };
}
