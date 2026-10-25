import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileCode,
  FolderPlus,
  Play,
  Save,
  RotateCw,
  Sidebar,
  Bot,
  Terminal,
  Settings,
  Plus,
} from 'lucide-react';
import { FileNode } from '../../types/project';

interface CommandItem {
  id: string;
  title: string;
  category: 'Actions' | 'Files' | 'Templates';
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
  onOpenFile: (path: string) => void;
  onCompile: () => void;
  onSave: () => void;
  onRefreshPdf: () => void;
  onToggleExplorer: () => void;
  onToggleAgent: () => void;
  onToggleDiagnostics: () => void;
  onOpenSettings: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onApplyTemplate: (templateId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  files,
  onOpenFile,
  onCompile,
  onSave,
  onRefreshPdf,
  onToggleExplorer,
  onToggleAgent,
  onToggleDiagnostics,
  onOpenSettings,
  onCreateFile,
  onCreateFolder,
  onApplyTemplate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all files into a list for quick open
  const flattenFiles = (nodes: FileNode[]): string[] => {
    let result: string[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push(node.path);
      }
      if (node.children) {
        result = result.concat(flattenFiles(node.children));
      }
    }
    return result;
  };

  const fileList = flattenFiles(files);

  const baseCommands: CommandItem[] = [
    {
      id: 'compile',
      title: 'Compile Document',
      category: 'Actions',
      shortcut: '⌘Enter',
      icon: <Play size={13} className="text-blue-400" />,
      action: () => {
        onCompile();
        onClose();
      },
    },
    {
      id: 'save',
      title: 'Save Active File',
      category: 'Actions',
      shortcut: '⌘S',
      icon: <Save size={13} className="text-neutral-400" />,
      action: () => {
        onSave();
        onClose();
      },
    },
    {
      id: 'refresh-pdf',
      title: 'Refresh PDF View',
      category: 'Actions',
      icon: <RotateCw size={13} className="text-neutral-400" />,
      action: () => {
        onRefreshPdf();
        onClose();
      },
    },
    {
      id: 'toggle-explorer',
      title: 'Toggle File Explorer',
      category: 'Actions',
      shortcut: '⌘B',
      icon: <Sidebar size={13} className="text-neutral-400" />,
      action: () => {
        onToggleExplorer();
        onClose();
      },
    },
    {
      id: 'toggle-agent',
      title: 'Toggle Agent',
      category: 'Actions',
      shortcut: '⌘J',
      icon: <Bot size={13} className="text-blue-400" />,
      action: () => {
        onToggleAgent();
        onClose();
      },
    },
    {
      id: 'toggle-diagnostics',
      title: 'Toggle Diagnostics Panel',
      category: 'Actions',
      shortcut: '⌘D',
      icon: <Terminal size={13} className="text-neutral-400" />,
      action: () => {
        onToggleDiagnostics();
        onClose();
      },
    },
    {
      id: 'new-file',
      title: 'Create New File',
      category: 'Actions',
      icon: <Plus size={13} className="text-neutral-400" />,
      action: () => {
        onCreateFile();
        onClose();
      },
    },
    {
      id: 'new-folder',
      title: 'Create New Folder',
      category: 'Actions',
      icon: <FolderPlus size={13} className="text-neutral-400" />,
      action: () => {
        onCreateFolder();
        onClose();
      },
    },
    {
      id: 'template-article',
      title: 'New from Template: Research Article',
      category: 'Templates',
      icon: <FileCode size={13} className="text-blue-400" />,
      action: () => {
        onApplyTemplate('article');
        onClose();
      },
    },
    {
      id: 'template-beamer',
      title: 'New from Template: Beamer Slide Deck (16:9)',
      category: 'Templates',
      icon: <FileCode size={13} className="text-emerald-400" />,
      action: () => {
        onApplyTemplate('beamer');
        onClose();
      },
    },
    {
      id: 'settings',
      title: 'Open Settings',
      category: 'Actions',
      shortcut: '⌘,',
      icon: <Settings size={13} className="text-neutral-400" />,
      action: () => {
        onOpenSettings();
        onClose();
      },
    },
  ];

  // Add files as commands
  const fileCommands: CommandItem[] = fileList.map((filePath) => ({
    id: `file-${filePath}`,
    title: `Open: ${filePath}`,
    category: 'Files',
    icon: <FileCode size={13} className="text-blue-400" />,
    action: () => {
      onOpenFile(filePath);
      onClose();
    },
  }));

  const allCommands = [...baseCommands, ...fileCommands];

  const filteredCommands = allCommands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#17181f] border border-[#2d303d] rounded-md shadow-2xl overflow-hidden font-mono text-xs flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#252834] bg-[#14151b]">
          <Search size={14} className="text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or file name..."
            className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-500 focus:outline-none text-xs"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-[#20222c] text-neutral-400 border border-[#2b2e3b] rounded">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-[11px]">No commands found</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#222530] text-neutral-100 font-medium'
                      : 'text-neutral-400 hover:bg-[#1a1c24]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {cmd.icon}
                    <span className="truncate">{cmd.title}</span>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-[#14151b] text-neutral-400 border border-[#292c38] rounded">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
