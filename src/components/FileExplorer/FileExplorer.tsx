import React, { useRef, useState } from 'react';
import {
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  FileCode,
  Image as ImageIcon,
  BookOpen,
  Upload,
  FolderUp,
  Download,
  CornerDownLeft,
} from 'lucide-react';
import { FileNode } from '../../types/project';
import { Tooltip } from '../common/Tooltip';
import { UploadItem, filesFromDrop, filesFromInput, INTERNAL_DRAG_TYPE, latexSnippetFor } from '../../utils/dropFiles';

interface FileExplorerProps {
  files: FileNode[];
  activeFilePath?: string;
  dirtyFiles: Set<string>;
  onSelectFile: (path: string) => void;
  onCreateFile: (parentPath?: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onRenameItem: (path: string, currentName: string) => void;
  onDeleteItem: (path: string) => void;
  onApplyTemplate?: (templateId: string) => void;
  onUploadFiles: (dir: string, items: UploadItem[]) => void;
  onMoveItem: (path: string, destDir: string) => void;
  onDownload: (path: string) => void;
  onInsertReference: (path: string) => void;
}

const parentDir = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFilePath,
  dirtyFiles,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onApplyTemplate,
  onUploadFiles,
  onMoveItem,
  onDownload,
  onInsertReference,
}) => {
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null); // '' = project root
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const uploadDir = useRef('');

  const toggleDir = (dirPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      next.has(dirPath) ? next.delete(dirPath) : next.add(dirPath);
      return next;
    });
  };

  const pickFiles = (dir: string, folder = false) => {
    uploadDir.current = dir;
    (folder ? folderInput : fileInput).current?.click();
  };

  // ---- Drag and drop: OS files/folders upload, explorer items move ----

  const dragOver = (e: React.DragEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(INTERNAL_DRAG_TYPE) ? 'move' : 'copy';
    if (dropTarget !== dir) setDropTarget(dir);
  };

  const drop = async (e: React.DragEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const internal = e.dataTransfer.getData(INTERNAL_DRAG_TYPE);
    if (internal) {
      if (internal !== dir && !dir.startsWith(internal + '/') && parentDir(internal) !== dir) onMoveItem(internal, dir);
      return;
    }
    const items = await filesFromDrop(e.dataTransfer);
    if (items.length) onUploadFiles(dir, items);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path: node.path, name: node.name, isDir: node.type === 'directory' });
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return collapsedDirs.has(node.path) ? (
        <Folder size={14} className="text-neutral-400 shrink-0" />
      ) : (
        <FolderOpen size={14} className="text-neutral-400 shrink-0" />
      );
    }
    switch (node.fileType) {
      case 'tex':
        return <FileCode size={14} className="text-blue-400 shrink-0" />;
      case 'bib':
        return <BookOpen size={14} className="text-amber-400 shrink-0" />;
      case 'image':
      case 'pdf':
        return <ImageIcon size={14} className="text-purple-400 shrink-0" />;
      default:
        return <FileText size={14} className="text-neutral-400 shrink-0" />;
    }
  };

  const renderTree = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      const isDir = node.type === 'directory';
      const isCollapsed = isDir && collapsedDirs.has(node.path);
      const isActive = !isDir && activeFilePath === node.path;
      const targetDir = isDir ? node.path : parentDir(node.path);

      return (
        <div key={node.path} className="select-none text-xs">
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(INTERNAL_DRAG_TYPE, node.path);
              e.dataTransfer.setData('text/plain', node.path);
              e.dataTransfer.effectAllowed = 'copyMove';
            }}
            onDragOver={(e) => dragOver(e, targetDir)}
            onDrop={(e) => drop(e, targetDir)}
            onClick={(e) => (isDir ? toggleDir(node.path, e) : onSelectFile(node.path))}
            onContextMenu={(e) => handleContextMenu(e, node)}
            className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors group relative ${
              isDir && dropTarget === node.path
                ? 'bg-blue-500/20 text-neutral-100 outline outline-1 outline-blue-500/60'
                : isActive
                ? 'bg-[#20232c] text-neutral-100 font-medium'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#181a21]'
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isDir ? (
              <span className="text-neutral-500 hover:text-neutral-300">
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </span>
            ) : (
              <span className="w-3" />
            )}
            {getFileIcon(node)}
            <span className="truncate flex-1 font-mono text-[11px]">{node.name}</span>
            {dirtyFiles.has(node.path) && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Modified" />}
          </div>

          {isDir && !isCollapsed && node.children && <div>{renderTree(node.children, depth + 1)}</div>}
        </div>
      );
    });

  const menuItem = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => {
        action();
        setContextMenu(null);
      }}
      className={`w-full text-left px-3 py-1.5 hover:bg-[#252834] flex items-center gap-2 ${danger ? 'text-rose-400' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const headerBtn = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <Tooltip content={label}>
      <button onClick={onClick} className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#20222a] transition-colors">
        {icon}
      </button>
    </Tooltip>
  );

  return (
    <aside className="h-full flex flex-col bg-[#14151a] border-r border-[#20222a] overflow-hidden" onClick={() => setContextMenu(null)}>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const items = filesFromInput(e.target.files);
          if (items.length) onUploadFiles(uploadDir.current, items);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          const items = filesFromInput(e.target.files);
          if (items.length) onUploadFiles(uploadDir.current, items);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-[#20222a] shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Explorer</span>
        <div className="flex items-center gap-0.5">
          {headerBtn('New file', <Plus size={13} />, () => onCreateFile())}
          {headerBtn('New folder', <FolderPlus size={13} />, () => onCreateFolder())}
          {headerBtn('Upload files (images, PDFs, .tex, .zip…)', <Upload size={13} />, () => pickFiles(''))}
          {headerBtn('Upload folder', <FolderUp size={13} />, () => pickFiles('', true))}
          {headerBtn('Download project as .zip', <Download size={13} />, () => onDownload(''))}
        </div>
      </div>

      {/* Tree; dropping on empty space targets the project root */}
      <div
        className={`flex-1 overflow-y-auto py-1 ${dropTarget === '' ? 'bg-blue-500/10 outline outline-1 -outline-offset-2 outline-blue-500/50' : ''}`}
        onDragOver={(e) => dragOver(e, '')}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
        }}
        onDrop={(e) => drop(e, '')}
      >
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500 font-mono">No files. Drop files or a folder here.</div>
        ) : (
          renderTree(files)
        )}
      </div>

      {onApplyTemplate && (
        <div className="p-2 border-t border-[#20222a] bg-[#111216] shrink-0 text-neutral-400">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 px-1">New From Template</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onApplyTemplate('article')}
              className="w-full text-left text-[11px] font-mono py-1 px-1.5 rounded hover:bg-[#1a1c24] text-neutral-300 hover:text-neutral-100 flex items-center gap-1.5 transition-colors"
            >
              <FileCode size={12} className="text-blue-400" />
              <span>Research Article</span>
            </button>
            <button
              onClick={() => onApplyTemplate('beamer')}
              className="w-full text-left text-[11px] font-mono py-1 px-1.5 rounded hover:bg-[#1a1c24] text-neutral-300 hover:text-neutral-100 flex items-center gap-1.5 transition-colors"
            >
              <FileCode size={12} className="text-emerald-400" />
              <span>Beamer Slides (16:9)</span>
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1a1b22] border border-[#2d2f3b] rounded shadow-xl py-1 w-52 text-xs text-neutral-300"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 260), left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isDir
            ? [
                menuItem(<Plus size={12} />, 'New file here', () => onCreateFile(contextMenu.path)),
                menuItem(<FolderPlus size={12} />, 'New folder here', () => onCreateFolder(contextMenu.path)),
                menuItem(<Upload size={12} />, 'Upload files here', () => pickFiles(contextMenu.path)),
                menuItem(<Download size={12} />, 'Download as .zip', () => onDownload(contextMenu.path)),
              ]
            : [
                latexSnippetFor(contextMenu.path, 'main.tex') &&
                  menuItem(<CornerDownLeft size={12} />, 'Insert into document', () => onInsertReference(contextMenu.path)),
                menuItem(<Download size={12} />, 'Download', () => onDownload(contextMenu.path)),
              ]}
          <div className="my-1 border-t border-[#2d2f3b]" />
          {menuItem(<Edit2 size={12} />, 'Rename', () => onRenameItem(contextMenu.path, contextMenu.name))}
          {menuItem(<Trash2 size={12} />, 'Delete', () => onDeleteItem(contextMenu.path), true)}
        </div>
      )}
    </aside>
  );
};
