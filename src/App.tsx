import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppShell } from './components/AppShell';
import { FileNode, OpenFile, FileType, ProjectSummary } from './types/project';
import { CompileResult } from './types/compiler';
import { AgentMessage, AgentSkillInfo, AgentFileEdit } from './types/agent';
import { AppSettings, DEFAULT_SETTINGS } from './types/settings';
import { PdfSyncTarget } from './components/PdfPreview/PdfPreview';
import { fileService } from './services/fileService';
import { compilerService } from './services/compilerService';
import { agentClient } from './services/agentClient';
import { skillsService } from './services/skillsService';
import { projectService } from './services/projectService';
import { UploadItem, filesFromDrop, INTERNAL_DRAG_TYPE, latexSnippetFor, isFigureFile } from './utils/dropFiles';

const SETTINGS_KEY = 'autotex.settings';
const TEXT_EXT = /\.(tex|bib|sty|cls|bst|txt|md|cfg|def|bbx|cbx|lbx|ist|json|ya?ml|csv|dat)$/i;

function loadSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved) {
      // Settings saved before opencode-only had `effort` and "oc:"-prefixed opencode model ids.
      const { effort, ...agent } = saved.agent ?? {};
      if (effort !== undefined) agent.model = agent.model?.startsWith('oc:') ? agent.model.slice(3) : '';
      return {
        editor: { ...DEFAULT_SETTINGS.editor, ...saved.editor },
        compiler: { ...DEFAULT_SETTINGS.compiler, ...saved.compiler },
        agent: { ...DEFAULT_SETTINGS.agent, ...agent },
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function flattenPaths(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) => (n.type === 'directory' ? flattenPaths(n.children ?? []) : [n.path]));
}

/** Compiler logs report paths like "./sections/intro.tex"; the editor uses project-relative paths. */
function normalizePath(p: string) {
  return p.replace(/^\.\//, '');
}

export const App: React.FC = () => {
  // Project
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectSummary | null>(null);

  // Files & editor
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>();
  // Typing must not re-render the app: live editor text and cursor live in refs; state only
  // changes when a file's dirty flag flips or content is committed (save, agent edit, revert).
  const liveContent = useRef(new Map<string, string>());
  const cursorLineRef = useRef(1);
  const [targetEditorLine, setTargetEditorLine] = useState<number | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{ startLine: number; endLine: number; text: string } | null>(null);
  const dirtyFiles = useMemo(() => new Set(openFiles.filter((f) => f.isDirty).map((f) => f.path)), [openFiles]);

  // Compiler / PDF
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [syncTarget, setSyncTarget] = useState<PdfSyncTarget | null>(null);

  // Agent (kept separate from editor state)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isAgentStreaming, setIsAgentStreaming] = useState(false);
  const [skills, setSkills] = useState<AgentSkillInfo[]>([]);
  const [agentConnected, setAgentConnected] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<AgentFileEdit | null>(null);
  // Undo/redo of whole agent turns, deliberately limited to the last 2 turns.
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const sessionLoaded = useRef(false);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const compilerEngine = settings.compiler.engine;
  const mainFile = currentProject?.mainFile || 'main.tex';

  // Latest open files for async handlers that outlive a render.
  const openFilesRef = useRef(openFiles);
  openFilesRef.current = openFiles;
  const contentOf = (f: OpenFile) => liveContent.current.get(f.path) ?? f.content;

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const refreshTree = useCallback(async () => {
    try {
      const tree = await fileService.getTree();
      setFiles(tree);
      return tree;
    } catch (e) {
      console.error('Failed to load tree:', e);
      return [];
    }
  }, []);

  const handleOpenFile = useCallback(async (filePath: string) => {
    if (!TEXT_EXT.test(filePath)) {
      // Images, PDFs and other binaries open in the browser's own viewer.
      window.open(`/api/files/read?path=${encodeURIComponent(filePath)}`, '_blank');
      return;
    }
    if (openFilesRef.current.some((f) => f.path === filePath)) {
      setActiveFilePath(filePath);
      return;
    }
    try {
      const content = await fileService.readFile(filePath);
      const name = filePath.split('/').pop() || filePath;
      const ext = name.split('.').pop() || '';
      const newFile: OpenFile = {
        path: filePath,
        name,
        content,
        initialContent: content,
        isDirty: false,
        fileType: (['tex', 'bib', 'sty', 'cls', 'bst'].includes(ext) ? ext : 'text') as FileType,
      };
      liveContent.current.delete(filePath);
      setOpenFiles((prev) => (prev.some((f) => f.path === filePath) ? prev : [...prev, newFile]));
      setActiveFilePath(filePath);
    } catch (err) {
      console.error(`Failed to open file ${filePath}:`, err);
    }
  }, []);

  const resetWorkspace = useCallback(
    async (project: ProjectSummary | null) => {
      setCurrentProject(project);
      liveContent.current.clear();
      setOpenFiles([]);
      setActiveFilePath(undefined);
      setPendingEdit(null);
      setCompileResult(null);
      setAgentMessages([]);
      setUndoStack([]);
      setRedoStack([]);
      sessionLoaded.current = false;
      const tree = await refreshTree();
      setAgentMessages((await agentClient.loadSession()).map((m) => ({ ...m, isStreaming: false })));
      sessionLoaded.current = true;
      const paths = flattenPaths(tree);
      const main = paths.find((p) => p === project?.mainFile) ?? paths.find((p) => p.endsWith('.tex'));
      if (main) await handleOpenFile(main);
      // Show the PDF from the last build until the next compile.
      const projectMain = project?.mainFile || 'main.tex';
      if (paths.includes(projectMain.replace(/\.tex$/i, '.pdf'))) {
        setCompileResult({
          success: true,
          pdfUrl: `/api/compiler/pdf?file=${encodeURIComponent(projectMain)}&t=${Date.now()}`,
          log: '',
          errors: [],
          warnings: [],
          executionTimeMs: 0,
          timestamp: Date.now(),
        });
      }
    },
    [refreshTree, handleOpenFile]
  );

  // Session memory (always on): store the chat transcript whenever it settles.
  useEffect(() => {
    if (!sessionLoaded.current || isAgentStreaming || agentMessages.length === 0) return;
    const timer = setTimeout(() => agentClient.saveSession(agentMessages), 300);
    return () => clearTimeout(timer);
  }, [agentMessages, isAgentStreaming]);

  const allEdits = () => agentMessages.flatMap((m) => m.edits ?? []);

  const reloadProjects = async () => {
    const data = await projectService.getProjects();
    setProjects(data.projects);
    return data;
  };

  const checkAgent = useCallback(async () => setAgentConnected(await agentClient.connect()), []);

  useEffect(() => {
    (async () => {
      try {
        const data = await reloadProjects();
        await resetWorkspace(data.projects.find((p) => p.id === data.activeId) || data.projects[0] || null);
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
      await checkAgent();
      setSkills(await skillsService.getSkills());
    })();
  }, []);

  const confirmDiscard = () =>
    dirtyFiles.size === 0 || window.confirm(`Discard unsaved changes in ${[...dirtyFiles].join(', ')}?`);

  const handleSelectProject = async (projectId: string) => {
    if (!confirmDiscard()) return;
    try {
      await resetWorkspace(await projectService.selectProject(projectId));
      await reloadProjects();
    } catch (e) {
      console.error('Failed to switch project:', e);
    }
  };

  const handleCreateProject = async (name: string, template: string) => {
    if (!confirmDiscard()) return;
    try {
      await resetWorkspace(await projectService.createProject(name, template));
      await reloadProjects();
    } catch (e) {
      console.error('Failed to create project:', e);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      const data = await reloadProjects();
      await resetWorkspace(data.projects.find((p) => p.id === data.activeId) || data.projects[0] || null);
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const saveDirtyFiles = async () => {
    const dirty = openFilesRef.current.filter((f) => f.isDirty);
    const saved = new Map(dirty.map((f) => [f.path, contentOf(f)]));
    await Promise.all([...saved].map(([path, content]) => fileService.writeFile(path, content)));
    setOpenFiles((prev) =>
      prev.map((f) => {
        const content = saved.get(f.path);
        return content === undefined ? f : { ...f, content, initialContent: content, isDirty: contentOf(f) !== content };
      })
    );
  };

  const isCompilingRef = useRef(false);
  // While the agent works it compiles on its own; a second compile in the same folder fights over
  // main.aux/main.pdf and tectonic's cache (8s becomes ~60s). Defer ours until the turn ends.
  const agentBusyRef = useRef(false);
  const compileAfterAgentRef = useRef(false);
  const handleCompile = useCallback(async () => {
    if (agentBusyRef.current) {
      compileAfterAgentRef.current = true;
      return;
    }
    if (isCompilingRef.current) return;
    isCompilingRef.current = true;
    setIsCompiling(true);
    try {
      await saveDirtyFiles();
      setCompileResult(await compilerService.compile({ mainFile, engine: compilerEngine, synctex: true }));
    } catch (err: any) {
      setCompileResult({
        success: false,
        pdfUrl: compileResult?.pdfUrl ?? null,
        log: err.message || 'Compilation failed',
        errors: [{ type: 'error', file: mainFile, line: 1, message: err.message || 'Compilation failed' }],
        warnings: [],
        executionTimeMs: 0,
        timestamp: Date.now(),
      });
    } finally {
      isCompilingRef.current = false;
      setIsCompiling(false);
    }
  }, [mainFile, compilerEngine, compileResult?.pdfUrl]);

  const handleSave = useCallback(async () => {
    const active = openFilesRef.current.find((f) => f.path === activeFilePath);
    if (!active?.isDirty) return;
    setIsSaving(true);
    try {
      const content = contentOf(active);
      await fileService.writeFile(active.path, content);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === active.path ? { ...f, content, initialContent: content, isDirty: contentOf(f) !== content } : f))
      );
      if (settings.compiler.autoCompileOnSave) handleCompile();
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  }, [activeFilePath, settings.compiler.autoCompileOnSave, handleCompile]);

  const handleChangeContent = (newContent: string) => {
    if (!activeFilePath) return;
    liveContent.current.set(activeFilePath, newContent);
    const file = openFilesRef.current.find((f) => f.path === activeFilePath);
    const isDirty = newContent !== file?.initialContent;
    if (file && file.isDirty !== isDirty) {
      setOpenFiles((prev) => prev.map((f) => (f.path === activeFilePath ? { ...f, isDirty } : f)));
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const file = openFiles.find((f) => f.path === path);
    if (file?.isDirty && !window.confirm(`${file.name} has unsaved changes. Close anyway?`)) return;
    const nextOpen = openFiles.filter((f) => f.path !== path);
    liveContent.current.delete(path);
    setOpenFiles(nextOpen);
    if (activeFilePath === path) setActiveFilePath(nextOpen[nextOpen.length - 1]?.path);
  };

  // File system operations
  const handleCreateFile = async (path: string) => {
    try {
      await fileService.createItem(path, 'file', '');
      await refreshTree();
      await handleOpenFile(path);
    } catch (e: any) {
      window.alert(e.message);
    }
  };

  const handleCreateFolder = async (path: string) => {
    try {
      await fileService.createItem(path, 'directory');
      await refreshTree();
    } catch (e: any) {
      window.alert(e.message);
    }
  };

  const handleRenameItem = async (oldPath: string, newPath: string) => {
    try {
      await fileService.renameItem(oldPath, newPath);
    } catch (e: any) {
      return window.alert(e.message);
    }
    await refreshTree();
    const remap = (p: string) => (p === oldPath ? newPath : p.startsWith(oldPath + '/') ? newPath + p.slice(oldPath.length) : p);
    setOpenFiles((prev) =>
      prev.map((f) => ({ ...f, content: contentOf(f), path: remap(f.path), name: remap(f.path).split('/').pop()! }))
    );
    liveContent.current = new Map([...liveContent.current].map(([p, c]) => [remap(p), c]));
    if (activeFilePath) setActiveFilePath(remap(activeFilePath));
  };

  const handleDeleteItem = async (path: string) => {
    if (!window.confirm(`Delete ${path}? This cannot be undone.`)) return;
    try {
      await fileService.deleteItem(path);
    } catch (e: any) {
      return window.alert(e.message);
    }
    await refreshTree();
    const removed = (p: string) => p === path || p.startsWith(path + '/');
    const nextOpen = openFiles.filter((f) => !removed(f.path));
    setOpenFiles(nextOpen);
    if (activeFilePath && removed(activeFilePath)) setActiveFilePath(nextOpen[nextOpen.length - 1]?.path);
  };

  // ---- Uploads, downloads, moves, inserting references ----

  const handleUploadFiles = async (dir: string, items: UploadItem[]): Promise<string[]> => {
    const zips = items.filter((i) => /\.zip$/i.test(i.path));
    const extract = zips.length > 0 && window.confirm(`Extract ${zips.map((z) => z.file.name).join(', ')} into /${dir}?`);
    try {
      const written = await fileService.upload(dir, items, extract);
      await refreshTree();
      // Reload open files that were overwritten.
      for (const f of openFilesRef.current.filter((o) => written.includes(o.path))) {
        const content = await fileService.readFile(f.path).catch(() => null);
        if (content !== null) syncOpenFile(f.path, content);
      }
      return written;
    } catch (e: any) {
      window.alert(e.message);
      return [];
    }
  };

  const handleMoveItem = (src: string, destDir: string) => {
    const name = src.split('/').pop()!;
    return handleRenameItem(src, destDir ? `${destDir}/${name}` : name);
  };

  const handleDownload = (path: string) => {
    const a = document.createElement('a');
    a.href = fileService.downloadUrl(path);
    a.download = '';
    a.click();
  };

  const [insertRequest, setInsertRequest] = useState<{ text: string; nonce: number } | null>(null);
  const handleInsertReference = (path: string) => {
    const text = latexSnippetFor(path, mainFile);
    if (!text) return;
    if (!activeFilePath?.endsWith('.tex')) return window.alert('Open a .tex file to insert into.');
    setInsertRequest({ text, nonce: Date.now() });
  };

  /** Drop onto the editor: explorer items insert a reference; OS files upload (figures/ for images), then insert. */
  const handleDropToEditor = async (dt: DataTransfer): Promise<string | null> => {
    const internal = dt.getData(INTERNAL_DRAG_TYPE);
    if (internal) return latexSnippetFor(internal, mainFile);
    const items = await filesFromDrop(dt);
    if (!items.length) return null;
    // Spaces and special characters break \includegraphics; make dropped figure names LaTeX-safe.
    const figures = items
      .filter((i) => isFigureFile(i.path))
      .map((i) => ({ ...i, path: i.path.replace(/[^\w./-]+/g, '-') }));
    const others = items.filter((i) => !isFigureFile(i.path));
    const written = [
      ...(figures.length ? await handleUploadFiles(mainFile.includes('/') ? `${mainFile.slice(0, mainFile.lastIndexOf('/'))}/figures` : 'figures', figures) : []),
      ...(others.length ? await handleUploadFiles('', others) : []),
    ];
    return written.map((p) => latexSnippetFor(p, mainFile)).filter(Boolean).join('\n') || null;
  };

  const handleImportProject = async (file: File) => {
    if (!confirmDiscard()) return;
    try {
      await resetWorkspace(await projectService.importZip(file));
      await reloadProjects();
    } catch (e: any) {
      window.alert(e.message);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!window.confirm('Applying a template overwrites files with the same names. Continue?')) return;
    try {
      const main = await skillsService.applyTemplate(templateId);
      await refreshTree();
      // Reload any open files the template overwrote.
      for (const f of openFilesRef.current) {
        const content = await fileService.readFile(f.path).catch(() => null);
        if (content !== null) {
          syncOpenFile(f.path, content);
        }
      }
      await handleOpenFile(main);
      await handleCompile();
    } catch (e) {
      console.error('Failed to apply template:', e);
    }
  };

  /** Mirror an on-disk change made by the agent (or a revert) into open editors. */
  const syncOpenFile = (file: string, content: string) => {
    liveContent.current.set(file, content);
    setOpenFiles((prev) => prev.map((f) => (f.path === file ? { ...f, content, initialContent: content, isDirty: false } : f)));
  };

  const updateAssistant = (id: string, fn: (m: AgentMessage) => AgentMessage) =>
    setAgentMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  const handleSendAgentMessage = async (prompt: string) => {
    setAgentMessages((prev) => [...prev, { id: `usr-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now() }]);
    setIsAgentStreaming(true);
    agentBusyRef.current = true;

    // The agent works on files on disk, so it must see what the editor shows.
    await saveDirtyFiles();

    const assistantMsgId = `ast-${Date.now()}`;
    setAgentMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [], edits: [], isStreaming: true },
    ]);

    const context = agentClient.getProjectContext(
      activeFilePath,
      cursorLineRef.current,
      currentSelection?.text,
      currentSelection ? { startLine: currentSelection.startLine, endLine: currentSelection.endLine } : undefined,
      flattenPaths(files),
      compileResult?.errors ?? []
    );

    let editCount = 0;
    try {
      await agentClient.sendMessage(
        prompt,
        context,
        { mainFile, engine: compilerEngine, model: settings.agent.model || undefined },
        {
        onToken: (token) => updateAssistant(assistantMsgId, (m) => ({ ...m, content: m.content + token })),
        onThinking: (text) => updateAssistant(assistantMsgId, (m) => ({ ...m, thinking: (m.thinking ?? '') + text })),
        onToolStart: (tool) => updateAssistant(assistantMsgId, (m) => ({ ...m, toolCalls: [...(m.toolCalls || []), tool] })),
        onToolFinish: (tool) =>
          updateAssistant(assistantMsgId, (m) => ({ ...m, toolCalls: (m.toolCalls || []).map((t) => (t.id === tool.id ? tool : t)) })),
        onEdit: (edit) => {
          editCount++;
          setPendingEdit(edit);
          updateAssistant(assistantMsgId, (m) => ({ ...m, edits: [...(m.edits || []), edit] }));
          syncOpenFile(edit.file, edit.newContent);
        },
        onComplete: (msg) =>
          updateAssistant(assistantMsgId, (m) => ({
            ...m,
            content: m.content || msg.content,
            thinking: m.thinking || msg.thinking,
            durationMs: msg.durationMs,
            totalTokens: msg.totalTokens,
            toolCalls: msg.toolCalls?.length ? msg.toolCalls : m.toolCalls,
            isStreaming: false,
          })),
        onError: (err) =>
          updateAssistant(assistantMsgId, (m) => ({
            ...m,
            content: m.content + (err.name === 'AbortError' ? '\n\nCancelled.' : `\n\nError: ${err.message}`),
            isStreaming: false,
          })),
        }
      );
    } catch (err) {
      console.error('Agent message error:', err);
    } finally {
      updateAssistant(assistantMsgId, (m) => ({ ...m, isStreaming: false }));
      setIsAgentStreaming(false);
      agentBusyRef.current = false;
    }

    if (editCount > 0) {
      setUndoStack((prev) => [...prev, assistantMsgId].slice(-2));
      setRedoStack([]); // a new turn invalidates redo
      await refreshTree();
    }
    if (editCount > 0 || compileAfterAgentRef.current) {
      compileAfterAgentRef.current = false;
      handleCompile();
    }
  };

  const handleCancelAgent = () => {
    agentClient.cancel();
    setIsAgentStreaming(false);
    agentBusyRef.current = false;
  };

  const markEdit = (editId: string, status: AgentFileEdit['status']) => {
    if (pendingEdit?.id === editId) setPendingEdit(null);
    setAgentMessages((prev) =>
      prev.map((m) => ({ ...m, edits: m.edits?.map((e) => (e.id === editId ? { ...e, status } : e)) }))
    );
  };

  // The agent already wrote the file; keeping it just clears the review state.
  const handleAcceptEdit = (editId: string) => markEdit(editId, 'accepted');

  /** Put a file into a given state on disk and in the editor; `null` means the file should not exist. */
  const setFileState = async (file: string, content: string | null) => {
    if (content === null) {
      await fileService.deleteItem(file).catch(() => {});
      liveContent.current.delete(file);
      setOpenFiles((prev) => prev.filter((f) => f.path !== file));
      if (activeFilePath === file) setActiveFilePath(undefined);
    } else {
      await fileService.writeFile(file, content);
      syncOpenFile(file, content);
    }
  };

  // An empty side of an edit means the file didn't exist (created or deleted by the agent).
  const beforeState = (e: AgentFileEdit) => (e.oldContent === '' && e.newContent !== '' ? null : e.oldContent);
  const afterState = (e: AgentFileEdit) => (e.newContent === '' && e.oldContent !== '' ? null : e.newContent);

  // Revert a single edit.
  const handleRevertEdit = async (editId: string) => {
    const edit = allEdits().find((e) => e.id === editId);
    if (!edit) return;
    try {
      await setFileState(edit.file, beforeState(edit));
      markEdit(editId, 'reverted');
      await refreshTree();
      handleCompile();
    } catch (e: any) {
      window.alert(`Revert failed: ${e.message}`);
    }
  };

  /** Undo (or redo) every still-applied edit of one agent turn, warning if files changed since. */
  const applyTurn = async (msgId: string, direction: 'undo' | 'redo') => {
    const msg = agentMessages.find((m) => m.id === msgId);
    const edits = (msg?.edits ?? []).filter((e) => e.status !== 'reverted');
    if (!msg) return false;
    const expected = (e: AgentFileEdit) => (direction === 'undo' ? afterState(e) : beforeState(e));
    const changed: string[] = [];
    for (const e of edits) {
      const disk = await fileService.readFile(e.file).catch(() => null);
      const open = openFilesRef.current.find((f) => f.path === e.file);
      const current = open ? contentOf(open) : disk;
      if (current !== expected(e)) changed.push(e.file);
    }
    if (changed.length && !window.confirm(`${changed.join(', ')} changed since this agent turn. Overwrite?`)) return false;
    const ordered = direction === 'undo' ? [...edits].reverse() : edits;
    for (const e of ordered) await setFileState(e.file, direction === 'undo' ? beforeState(e) : afterState(e));
    if (pendingEdit && edits.some((e) => e.id === pendingEdit.id)) setPendingEdit(null);
    setAgentMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, undone: direction === 'undo' } : m)));
    await refreshTree();
    handleCompile();
    return true;
  };

  const handleUndoTurn = async () => {
    const id = undoStack[undoStack.length - 1];
    if (id && (await applyTurn(id, 'undo'))) {
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, id].slice(-2));
    }
  };

  const handleRedoTurn = async () => {
    const id = redoStack[redoStack.length - 1];
    if (id && (await applyTurn(id, 'redo'))) {
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, id].slice(-2));
    }
  };

  // Green/red highlight for the active file: its latest agent edit still awaiting Keep/Revert.
  const changeHighlight = useMemo(() => {
    if (!settings.agent.highlightChanges || !activeFilePath) return null;
    for (let i = agentMessages.length - 1; i >= 0; i--) {
      const m = agentMessages[i]!;
      if (m.undone) continue;
      const edit = m.edits?.find((e) => e.file === activeFilePath);
      if (edit) return edit.status === 'pending' ? edit : null;
    }
    return null;
  }, [agentMessages, activeFilePath, settings.agent.highlightChanges]);

  const handleNavigateToLine = async (file: string, line: number) => {
    const path = normalizePath(file);
    if (activeFilePath !== path) await handleOpenFile(path);
    setTargetEditorLine(null);
    requestAnimationFrame(() => setTargetEditorLine(line));
  };

  // SyncTeX: PDF double-click -> source.
  const handlePdfClick = async (page: number, x: number, y: number) => {
    const res = await compilerService.reverseSync(mainFile, page, x, y).catch(() => null);
    if (res) await handleNavigateToLine(res.file, res.line);
  };

  // SyncTeX: cursor -> PDF.
  const handleSyncFromCursor = async () => {
    if (!activeFilePath?.endsWith('.tex')) return;
    const res = await compilerService.forwardSync(mainFile, activeFilePath, cursorLineRef.current).catch(() => null);
    if (res) setSyncTarget({ page: res.page, y: res.y, nonce: Date.now() });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCompile]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyFiles.size > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyFiles]);

  return (
    <AppShell
      currentProject={currentProject}
      projects={projects}
      onSelectProject={handleSelectProject}
      onCreateProject={handleCreateProject}
      onDeleteProject={handleDeleteProject}
      pendingEdit={pendingEdit}
      files={files}
      openFiles={openFiles.map((f) => (liveContent.current.has(f.path) ? { ...f, content: contentOf(f) } : f))}
      activeFilePath={activeFilePath}
      dirtyFiles={dirtyFiles}
      compilerEngine={compilerEngine}
      isCompiling={isCompiling}
      isSaving={isSaving}
      compileResult={compileResult}
      syncTarget={syncTarget}
      agentMessages={agentMessages}
      isAgentStreaming={isAgentStreaming}
      skills={skills}
      settings={settings}
      agentConnected={agentConnected}
      agentModel={agentClient.agentModel}
      onRetryAgent={checkAgent}
      targetEditorLine={targetEditorLine}
      currentSelection={currentSelection}
      onSelectFile={handleOpenFile}
      onSelectTab={(p) => setActiveFilePath(p)}
      onCloseTab={handleCloseTab}
      onChangeContent={handleChangeContent}
      onSelectionChange={setCurrentSelection}
      onCursorChange={(line) => (cursorLineRef.current = line)}
      onCompile={handleCompile}
      onSave={handleSave}
      onRefreshPdf={handleCompile}
      onChangeEngine={(engine) => setSettings((s) => ({ ...s, compiler: { ...s.compiler, engine } }))}
      onSaveSettings={setSettings}
      onDeleteStoredSessions={async () => {
        if (!window.confirm(`Permanently delete all saved agent conversations for "${currentProject?.name}"? This cannot be undone.`)) return false;
        await agentClient.deleteStoredSessions();
        setAgentMessages([]);
        setUndoStack([]);
        setRedoStack([]);
        return true;
      }}
      onCreateFile={handleCreateFile}
      onCreateFolder={handleCreateFolder}
      onRenameItem={handleRenameItem}
      onDeleteItem={handleDeleteItem}
      onApplyTemplate={handleApplyTemplate}
      onSendAgentMessage={handleSendAgentMessage}
      onCancelAgent={handleCancelAgent}
      onAcceptEdit={handleAcceptEdit}
      onRevertEdit={handleRevertEdit}
      onClearSelection={() => setCurrentSelection(null)}
      onNavigateToLine={handleNavigateToLine}
      onPdfClick={handlePdfClick}
      onSyncFromCursor={handleSyncFromCursor}
      onNewConversation={() => {
        agentClient.reset();
        setAgentMessages([]);
        setUndoStack([]);
        setRedoStack([]);
      }}
      onUploadFiles={handleUploadFiles}
      onMoveItem={handleMoveItem}
      onDownload={handleDownload}
      onInsertReference={handleInsertReference}
      onDropToEditor={handleDropToEditor}
      insertRequest={insertRequest}
      onImportProject={handleImportProject}
      onUndoTurn={handleUndoTurn}
      onRedoTurn={handleRedoTurn}
      undoCount={undoStack.length}
      redoCount={redoStack.length}
      changeHighlight={changeHighlight}
    />
  );
};
