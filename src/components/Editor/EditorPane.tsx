import React from 'react';
import { EditorTabs } from './EditorTabs';
import { CodeEditor } from './CodeEditor';
import { OpenFile } from '../../types/project';
import { DiagnosticItem } from '../../types/compiler';
import { MessageSquare, Bot, Check, X, Eye } from 'lucide-react';
import { AgentFileEdit } from '../../types/agent';

interface EditorPaneProps {
  openFiles: OpenFile[];
  activeFilePath?: string;
  diagnostics: DiagnosticItem[];
  targetLine: number | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
  onChangeContent: (content: string) => void;
  onSelectionChange: (selection: {
    startLine: number;
    endLine: number;
    text: string;
  } | null) => void;
  onAskAgentAboutSelection: () => void;
  currentSelection: {
    startLine: number;
    endLine: number;
    text: string;
  } | null;
  onCursorChange?: (line: number) => void;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  lineNumbers?: 'on' | 'off';
  pendingEdit?: AgentFileEdit | null;
  onAcceptEdit?: (editId: string) => void;
  onRejectEdit?: (editId: string) => void;
  onReviewEdit?: (edit: AgentFileEdit) => void;
  changeHighlight?: AgentFileEdit | null;
  onDropToEditor?: (dt: DataTransfer) => Promise<string | null>;
  insertRequest?: { text: string; nonce: number } | null;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  openFiles,
  activeFilePath,
  diagnostics,
  targetLine,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSelectionChange,
  onAskAgentAboutSelection,
  currentSelection,
  onCursorChange,
  fontSize,
  tabSize,
  wordWrap,
  lineNumbers,
  pendingEdit,
  onAcceptEdit,
  onRejectEdit,
  onReviewEdit,
  changeHighlight,
  onDropToEditor,
  insertRequest,
}) => {
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#16171d] text-neutral-500 font-mono text-xs select-none">
        <div className="text-center">
          <p className="text-neutral-400 font-medium mb-1">No file open</p>
          <p className="text-[11px] text-neutral-500">Select a file from the explorer.</p>
        </div>
      </div>
    );
  }

  // Filter diagnostics for the active file
  const activeDiagnostics = diagnostics.filter(
    (d) => d.file === activeFile.path || d.file.replace(/^\.\//, '') === activeFile.path || activeFile.path.endsWith('/' + d.file)
  );

  return (
    <div className="relative h-full flex flex-col bg-[#16171d] overflow-hidden">
      {/* Tabs */}
      <EditorTabs
        openFiles={openFiles}
        activeFilePath={activeFilePath}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />

      {/* Live Agent Pending Edit Banner (Section 11) */}
      {pendingEdit && (
        <div className="bg-blue-950/80 border-b border-blue-500/30 px-3 py-1.5 flex items-center justify-between text-xs font-mono text-blue-200 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-blue-400 shrink-0" />
            <span className="font-semibold text-neutral-200">Agent edited</span>
            <span className="text-neutral-400 truncate max-w-[180px]">{pendingEdit.file}</span>
            <span className="text-emerald-400 font-medium">+{pendingEdit.additions}</span>
            <span className="text-rose-400 font-medium">-{pendingEdit.deletions}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onReviewEdit && (
              <button
                onClick={() => onReviewEdit(pendingEdit)}
                className="px-2 py-0.5 rounded bg-[#1e2333] hover:bg-[#282f45] text-neutral-200 flex items-center gap-1 border border-[#353d5a] transition-colors"
                title="View full visual diff"
              >
                <Eye size={12} />
                <span>Review</span>
              </button>
            )}
            {onAcceptEdit && (
              <button
                onClick={() => onAcceptEdit(pendingEdit.id)}
                className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 shadow-sm transition-colors"
                title="Keep the agent's changes"
              >
                <Check size={12} />
                <span>Keep</span>
              </button>
            )}
            {onRejectEdit && (
              <button
                onClick={() => onRejectEdit(pendingEdit.id)}
                className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 flex items-center gap-1 border border-rose-800/40 transition-colors"
                title="Restore the file as it was before the agent edit"
              >
                <X size={12} />
                <span>Revert</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editor Surface */}
      <div className="flex-1 relative overflow-hidden">
        <CodeEditor
          path={activeFile.path}
          content={activeFile.content}
          onChange={onChangeContent}
          diagnostics={activeDiagnostics}
          targetLine={targetLine}
          onSelectionChange={onSelectionChange}
          onCursorChange={onCursorChange}
          changeHighlight={changeHighlight?.file === activeFile.path ? changeHighlight : null}
          onDropToEditor={onDropToEditor}
          insertRequest={insertRequest}
          fontSize={fontSize}
          tabSize={tabSize}
          wordWrap={wordWrap}
          lineNumbers={lineNumbers}
        />

        {/* Floating "Ask Agent" button when text is selected */}
        {currentSelection && currentSelection.text.trim().length > 0 && (
          <div className="absolute bottom-10 right-8 z-20 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={onAskAgentAboutSelection}
              className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium shadow-lg flex items-center gap-1.5 transition-all border border-blue-400/30"
            >
              <MessageSquare size={12} />
              <span>Ask agent about selection</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
