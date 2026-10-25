import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from './TopBar';
import { FileExplorer } from './FileExplorer/FileExplorer';
import { EditorPane } from './Editor/EditorPane';
import { PdfPreview, PdfSyncTarget } from './PdfPreview/PdfPreview';
import { AgentPanel } from './AgentChat/AgentPanel';
import { DiagnosticsPanel } from './Diagnostics/DiagnosticsPanel';
import { CommandPalette } from './CommandPalette/CommandPalette';
import { SettingsDialog } from './Settings/SettingsDialog';
import { Modal } from './common/Modal';
import { FileNode, OpenFile, ProjectSummary } from '../types/project';
import { CompileResult, CompilerEngine, DiagnosticItem } from '../types/compiler';
import { AgentMessage, AgentSkillInfo, AgentFileEdit } from '../types/agent';
import { AppSettings } from '../types/settings';
import { DiffReviewModal } from './AgentChat/DiffReviewModal';
import { UploadItem } from '../utils/dropFiles';

interface AppShellProps {
  currentProject: ProjectSummary | null;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, template: string) => void;
  onDeleteProject: (projectId: string) => void;
  pendingEdit: AgentFileEdit | null;
  files: FileNode[];
  openFiles: OpenFile[];
  activeFilePath?: string;
  dirtyFiles: Set<string>;
  compilerEngine: CompilerEngine;
  isCompiling: boolean;
  isSaving: boolean;
  compileResult: CompileResult | null;
  syncTarget: PdfSyncTarget | null;
  agentMessages: AgentMessage[];
  isAgentStreaming: boolean;
  skills: AgentSkillInfo[];
  settings: AppSettings;
  agentConnected: boolean;
  agentModel: string;
  onRetryAgent: () => void;
  targetEditorLine: number | null;
  currentSelection: {
    startLine: number;
    endLine: number;
    text: string;
  } | null;

  // Handlers
  onSelectFile: (path: string) => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
  onChangeContent: (content: string) => void;
  onSelectionChange: (sel: any) => void;
  onCursorChange: (line: number) => void;
  onCompile: () => void;
  onSave: () => void;
  onRefreshPdf: () => void;
  onChangeEngine: (engine: CompilerEngine) => void;
  onSaveSettings: (settings: AppSettings) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRenameItem: (oldPath: string, newPath: string) => void;
  onDeleteItem: (path: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onSendAgentMessage: (text: string) => void;
  onCancelAgent: () => void;
  onAcceptEdit: (editId: string) => void;
  onRevertEdit: (editId: string) => void;
  onClearSelection: () => void;
  onNavigateToLine: (file: string, line: number) => void;
  onPdfClick: (page: number, x: number, y: number) => void;
  onSyncFromCursor: () => void;
  onNewConversation: () => void;
  onUndoTurn: () => void;
  onRedoTurn: () => void;
  undoCount: number;
  redoCount: number;
  changeHighlight: AgentFileEdit | null;
  onUploadFiles: (dir: string, items: UploadItem[]) => void;
  onMoveItem: (path: string, destDir: string) => void;
  onDownload: (path: string) => void;
  onInsertReference: (path: string) => void;
  onDropToEditor: (dt: DataTransfer) => Promise<string | null>;
  insertRequest: { text: string; nonce: number } | null;
  onImportProject: (file: File) => void;
  onDeleteStoredSessions: () => Promise<boolean>;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  pendingEdit,
  files,
  openFiles,
  activeFilePath,
  dirtyFiles,
  compilerEngine,
  isCompiling,
  isSaving,
  compileResult,
  syncTarget,
  agentMessages,
  isAgentStreaming,
  skills,
  settings,
  agentConnected,
  agentModel,
  onRetryAgent,
  targetEditorLine,
  currentSelection,
  onSelectFile,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSelectionChange,
  onCursorChange,
  onCompile,
  onSave,
  onRefreshPdf,
  onChangeEngine,
  onSaveSettings,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onApplyTemplate,
  onSendAgentMessage,
  onCancelAgent,
  onAcceptEdit,
  onRevertEdit,
  onClearSelection,
  onNavigateToLine,
  onPdfClick,
  onSyncFromCursor,
  onNewConversation,
  onUndoTurn,
  onRedoTurn,
  undoCount,
  redoCount,
  changeHighlight,
  onUploadFiles,
  onMoveItem,
  onDownload,
  onInsertReference,
  onDropToEditor,
  insertRequest,
  onImportProject,
  onDeleteStoredSessions,
}) => {
  // Panel visibilities
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reviewingEdit, setReviewingEdit] = useState<AgentFileEdit | null>(null);

  // Collapse side panels by default on narrow windows.
  useEffect(() => {
    if (window.innerWidth < 1100) setIsExplorerOpen(false);
  }, []);

  // Files dropped outside a drop zone would make the browser navigate away from the app.
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  // Panel shortcuts (save/compile live in App).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (key === 'b' && !e.shiftKey) {
        e.preventDefault();
        setIsExplorerOpen((v) => !v);
      } else if (key === 'j') {
        e.preventDefault();
        setIsAgentOpen((v) => !v);
      } else if (key === 'd' && e.shiftKey) {
        e.preventDefault();
        setIsDiagnosticsOpen((v) => !v);
      } else if (key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Modals for creating/renaming
  const [newFileModal, setNewFileModal] = useState<{ isOpen: boolean; parentPath?: string }>({
    isOpen: false,
  });
  const [newFolderModal, setNewFolderModal] = useState<{ isOpen: boolean; parentPath?: string }>({
    isOpen: false,
  });
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    path: string;
    currentName: string;
  }>({
    isOpen: false,
    path: '',
    currentName: '',
  });

  const [inputVal, setInputVal] = useState('');

  // Workspace split resizing
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [editorRatio, setEditorRatio] = useState(50); // percentage of central area

  const isResizingExplorer = useRef(false);
  const isResizingEditor = useRef(false);

  const handleMouseDownExplorer = () => {
    isResizingExplorer.current = true;
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingExplorer.current) return;
      setExplorerWidth(Math.max(160, Math.min(450, e.clientX)));
    };
    const onMouseUp = () => {
      isResizingExplorer.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleMouseDownEditorSplit = () => {
    isResizingEditor.current = true;
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingEditor.current) return;
      const containerWidth = window.innerWidth - (isExplorerOpen ? explorerWidth : 0);
      const relativeX = e.clientX - (isExplorerOpen ? explorerWidth : 0);
      const ratio = (relativeX / containerWidth) * 100;
      setEditorRatio(Math.max(25, Math.min(75, ratio)));
    };
    const onMouseUp = () => {
      isResizingEditor.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const errors = compileResult?.errors ?? [];
  const warnings = compileResult?.warnings ?? [];
  const fullLog = compileResult?.log ?? '';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121316] text-[#c9cdd4] overflow-hidden select-none">
      {/* Top Application Bar */}
      <TopBar
        currentProject={currentProject}
        projects={projects}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
        onDeleteProject={onDeleteProject}
        onImportProject={onImportProject}
        isCompiling={isCompiling}
        isSaving={isSaving}
        hasErrors={errors.length > 0}
        isDirty={dirtyFiles.size > 0}
        onCompile={onCompile}
        onSave={onSave}
        onRefreshPdf={onRefreshPdf}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isExplorerOpen={isExplorerOpen}
        onToggleExplorer={() => setIsExplorerOpen(!isExplorerOpen)}
        isAgentOpen={isAgentOpen}
        onToggleAgent={() => setIsAgentOpen(!isAgentOpen)}
        isDiagnosticsOpen={isDiagnosticsOpen}
        onToggleDiagnostics={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
        compilerEngine={compilerEngine}
        onChangeEngine={onChangeEngine}
      />

      {/* Main 3-Region Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Region 1: File Explorer */}
        {isExplorerOpen && (
          <>
            <div style={{ width: `${explorerWidth}px` }} className="shrink-0 h-full">
              <FileExplorer
                files={files}
                activeFilePath={activeFilePath}
                dirtyFiles={dirtyFiles}
                onSelectFile={onSelectFile}
                onCreateFile={(parent) => {
                  setInputVal('');
                  setNewFileModal({ isOpen: true, parentPath: parent });
                }}
                onCreateFolder={(parent) => {
                  setInputVal('');
                  setNewFolderModal({ isOpen: true, parentPath: parent });
                }}
                onRenameItem={(p, name) => {
                  setInputVal(name);
                  setRenameModal({ isOpen: true, path: p, currentName: name });
                }}
                onDeleteItem={onDeleteItem}
                onApplyTemplate={onApplyTemplate}
                onUploadFiles={onUploadFiles}
                onMoveItem={onMoveItem}
                onDownload={onDownload}
                onInsertReference={onInsertReference}
              />
            </div>
            {/* Splitter */}
            <div
              onMouseDown={handleMouseDownExplorer}
              className="w-1 hover:w-1.5 hover:bg-blue-500/50 bg-[#20222a] cursor-col-resize shrink-0 transition-colors z-10"
            />
          </>
        )}

        {/* Central Workspace: Editor (50%) + PDF Preview (50%) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Region 2: LaTeX Editor */}
          <div style={{ width: `${editorRatio}%` }} className="h-full flex flex-col overflow-hidden">
            <EditorPane
              openFiles={openFiles}
              activeFilePath={activeFilePath}
              diagnostics={errors}
              targetLine={targetEditorLine}
              onSelectTab={onSelectTab}
              onCloseTab={onCloseTab}
              onChangeContent={onChangeContent}
              onSelectionChange={onSelectionChange}
              onCursorChange={onCursorChange}
              onAskAgentAboutSelection={() => setIsAgentOpen(true)}
              currentSelection={currentSelection}
              fontSize={settings.editor.fontSize}
              tabSize={settings.editor.tabSize}
              wordWrap={settings.editor.wordWrap}
              lineNumbers={settings.editor.lineNumbers}
              pendingEdit={pendingEdit}
              onAcceptEdit={onAcceptEdit}
              onRejectEdit={onRevertEdit}
              onReviewEdit={(edit) => setReviewingEdit(edit)}
              changeHighlight={changeHighlight}
              onDropToEditor={onDropToEditor}
              insertRequest={insertRequest}
            />
          </div>

          {/* Central Splitter */}
          <div
            onMouseDown={handleMouseDownEditorSplit}
            className="w-1 hover:w-1.5 hover:bg-blue-500/50 bg-[#20222a] cursor-col-resize shrink-0 transition-colors z-10"
          />

          {/* Region 3: PDF Preview */}
          <div style={{ width: `${100 - editorRatio}%` }} className="h-full overflow-hidden">
            <PdfPreview
              pdfUrl={compileResult?.pdfUrl ?? null}
              isCompiling={isCompiling}
              errors={errors}
              syncTarget={syncTarget}
              onRefresh={onRefreshPdf}
              onNavigateToError={onNavigateToLine}
              onPdfClick={onPdfClick}
              onSyncFromCursor={onSyncFromCursor}
            />
          </div>
        </div>
      </div>

      {/* Diagnostics Bottom Panel */}
      <DiagnosticsPanel
        errors={errors}
        warnings={warnings}
        fullLog={fullLog}
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onNavigateToLine={onNavigateToLine}
      />

      {/* Agent Chat Bottom Panel */}
      {isAgentOpen && (
        <AgentPanel
          messages={agentMessages}
          isStreaming={isAgentStreaming}
          onSendMessage={onSendAgentMessage}
          onCancel={onCancelAgent}
          onAcceptEdit={onAcceptEdit}
          onRevertEdit={onRevertEdit}
          currentSelection={currentSelection}
          onClearSelection={onClearSelection}
          skills={skills}
          isCollapsed={false}
          onToggleCollapse={() => setIsAgentOpen(false)}
          onNewConversation={onNewConversation}
          onUndoTurn={onUndoTurn}
          onRedoTurn={onRedoTurn}
          undoCount={undoCount}
          redoCount={redoCount}
          showThinking={settings.agent.showThinking}
          model={settings.agent.model}
          onChangeModel={(model) => onSaveSettings({ ...settings, agent: { ...settings.agent, model } })}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        files={files}
        onOpenFile={onSelectFile}
        onCompile={onCompile}
        onSave={onSave}
        onRefreshPdf={onRefreshPdf}
        onToggleExplorer={() => setIsExplorerOpen(!isExplorerOpen)}
        onToggleAgent={() => setIsAgentOpen(!isAgentOpen)}
        onToggleDiagnostics={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateFile={() => {
          setInputVal('');
          setNewFileModal({ isOpen: true });
        }}
        onCreateFolder={() => {
          setInputVal('');
          setNewFolderModal({ isOpen: true });
        }}
        onApplyTemplate={onApplyTemplate}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={onSaveSettings}
        agentConnected={agentConnected}
        agentModel={agentModel}
        onRetryAgent={onRetryAgent}
        onDeleteStoredSessions={onDeleteStoredSessions}
      />

      {/* New File Modal */}
      <Modal
        isOpen={newFileModal.isOpen}
        onClose={() => setNewFileModal({ isOpen: false })}
        title="Create New File"
        width="max-w-sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputVal.trim()) {
              const full = newFileModal.parentPath
                ? `${newFileModal.parentPath}/${inputVal.trim()}`
                : inputVal.trim();
              onCreateFile(full);
              setNewFileModal({ isOpen: false });
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <label className="block text-neutral-400">File Name (e.g. section.tex)</label>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFileModal({ isOpen: false })}
              className="px-3 py-1 rounded bg-[#1f212a] text-neutral-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white font-medium">
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderModal.isOpen}
        onClose={() => setNewFolderModal({ isOpen: false })}
        title="Create New Folder"
        width="max-w-sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputVal.trim()) {
              const full = newFolderModal.parentPath
                ? `${newFolderModal.parentPath}/${inputVal.trim()}`
                : inputVal.trim();
              onCreateFolder(full);
              setNewFolderModal({ isOpen: false });
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <label className="block text-neutral-400">Folder Name (e.g. sections)</label>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFolderModal({ isOpen: false })}
              className="px-3 py-1 rounded bg-[#1f212a] text-neutral-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white font-medium">
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false, path: '', currentName: '' })}
        title="Rename Item"
        width="max-w-sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputVal.trim() && inputVal.trim() !== renameModal.currentName) {
              const dir = renameModal.path.includes('/')
                ? renameModal.path.substring(0, renameModal.path.lastIndexOf('/'))
                : '';
              const newPath = dir ? `${dir}/${inputVal.trim()}` : inputVal.trim();
              onRenameItem(renameModal.path, newPath);
              setRenameModal({ isOpen: false, path: '', currentName: '' });
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <label className="block text-neutral-400">New Name</label>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRenameModal({ isOpen: false, path: '', currentName: '' })}
              className="px-3 py-1 rounded bg-[#1f212a] text-neutral-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white font-medium">
              Rename
            </button>
          </div>
        </form>
      </Modal>

      {/* Full Visual Diff Review Modal (Section 11) */}
      <DiffReviewModal
        edit={reviewingEdit}
        onClose={() => setReviewingEdit(null)}
        onAccept={onAcceptEdit}
        onRevert={onRevertEdit}
      />
    </div>
  );
};
