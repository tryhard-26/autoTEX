import React from 'react';
import { X, FileCode, BookOpen, FileText } from 'lucide-react';
import { OpenFile } from '../../types/project';

interface EditorTabsProps {
  openFiles: OpenFile[];
  activeFilePath?: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openFiles,
  activeFilePath,
  onSelectTab,
  onCloseTab,
}) => {
  const getTabIcon = (fileType: string) => {
    switch (fileType) {
      case 'tex':
        return <FileCode size={13} className="text-blue-400" />;
      case 'bib':
        return <BookOpen size={13} className="text-amber-400" />;
      default:
        return <FileText size={13} className="text-neutral-400" />;
    }
  };

  return (
    <div className="h-8 border-b border-[#20222a] bg-[#14151a] flex items-center overflow-x-auto select-none no-scrollbar">
      {openFiles.map((file) => {
        const isActive = activeFilePath === file.path;
        return (
          <div
            key={file.path}
            onClick={() => onSelectTab(file.path)}
            className={`h-full flex items-center gap-2 px-3 border-r border-[#20222a] cursor-pointer text-xs font-mono transition-colors group relative ${
              isActive
                ? 'bg-[#181920] text-neutral-100 font-medium'
                : 'bg-[#121318] text-neutral-400 hover:text-neutral-200 hover:bg-[#15171d]'
            }`}
          >
            {/* Active top line indicator */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}

            {getTabIcon(file.fileType)}

            <span className="truncate max-w-[120px] text-[11px]">{file.name}</span>

            {/* Dirty or close button */}
            <div className="flex items-center">
              {file.isDirty ? (
                <span
                  onClick={(e) => onCloseTab(file.path, e)}
                  className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                  title="Unsaved changes"
                />
              ) : null}
              <button
                onClick={(e) => onCloseTab(file.path, e)}
                className={`p-0.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-[#262832] ${
                  file.isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
