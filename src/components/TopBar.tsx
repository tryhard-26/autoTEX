import React from 'react';
import {
  Play,
  Save,
  RotateCw,
  Settings,
  Sidebar,
  Bot,
  Terminal,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { CompilerEngine } from '../types/compiler';
import { ProjectSummary } from '../types/project';
import { ProjectSwitcher } from './Project/ProjectSwitcher';

interface TopBarProps {
  currentProject: ProjectSummary | null;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, template: string) => void;
  onDeleteProject: (projectId: string) => void;
  onImportProject: (file: File) => void;
  isCompiling: boolean;
  isSaving: boolean;
  hasErrors: boolean;
  isDirty: boolean;
  onCompile: () => void;
  onSave: () => void;
  onRefreshPdf: () => void;
  onOpenSettings: () => void;
  isExplorerOpen: boolean;
  onToggleExplorer: () => void;
  isAgentOpen: boolean;
  onToggleAgent: () => void;
  isDiagnosticsOpen: boolean;
  onToggleDiagnostics: () => void;
  compilerEngine: CompilerEngine;
  onChangeEngine: (engine: CompilerEngine) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onImportProject,
  isCompiling,
  isSaving,
  hasErrors,
  isDirty,
  onCompile,
  onSave,
  onRefreshPdf,
  onOpenSettings,
  isExplorerOpen,
  onToggleExplorer,
  isAgentOpen,
  onToggleAgent,
  isDiagnosticsOpen,
  onToggleDiagnostics,
  compilerEngine,
  onChangeEngine,
}) => {
  return (
    <header className="h-10 border-b border-[#20222a] bg-[#14151a] flex items-center justify-between px-3 shrink-0 select-none">
      {/* Left section: App branding + Projects Hub + Project Switcher */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Tooltip content="Toggle File Explorer" shortcut="⌘B">
            <button
              onClick={onToggleExplorer}
              className={`p-1 rounded text-neutral-400 hover:text-neutral-200 transition-colors ${
                isExplorerOpen ? 'bg-[#22252e] text-neutral-200' : 'hover:bg-[#1b1d24]'
              }`}
            >
              <Sidebar size={15} />
            </button>
          </Tooltip>
          <span className="font-mono text-xs font-semibold text-neutral-300 tracking-wider">
            autoTEX
          </span>
        </div>

        <div className="h-3.5 w-px bg-[#262832]" />

        {/* Dynamic Project Switcher with Templates and Creation */}
        <ProjectSwitcher
          currentProject={currentProject}
          projects={projects}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
          onImportProject={onImportProject}
          isDirty={isDirty}
        />
      </div>

      {/* Center section: Compiler & Document Actions */}
      <div className="flex items-center gap-1.5">
        {/* Compiler engine selector */}
        <select
          value={compilerEngine}
          onChange={(e) => onChangeEngine(e.target.value as CompilerEngine)}
          className="h-7 text-[11px] font-mono bg-[#1a1b22] text-neutral-300 border border-[#272933] rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="tectonic">tectonic</option>
          <option value="pdflatex">pdflatex</option>
          <option value="xelatex">xelatex</option>
          <option value="lualatex">lualatex</option>
          <option value="latexmk">latexmk</option>
        </select>

        {/* Compile / Build button */}
        <Tooltip content="Compile Document" shortcut="⌘Enter">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isCompiling
                ? 'bg-[#1e222d] text-neutral-400 cursor-not-allowed'
                : 'bg-blue-600/80 hover:bg-blue-600 text-white active:bg-blue-700'
            }`}
          >
            {isCompiling ? (
              <Loader2 size={13} className="animate-spin text-blue-400" />
            ) : (
              <Play size={12} className="fill-current" />
            )}
            <span>{isCompiling ? 'Building...' : 'Build'}</span>
          </button>
        </Tooltip>

        {/* Save button */}
        <Tooltip content="Save File" shortcut="⌘S">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="h-7 px-2 rounded text-xs text-neutral-300 bg-[#1b1d24] hover:bg-[#242732] border border-[#272933] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Save size={13} />
            <span>Save</span>
          </button>
        </Tooltip>

        {/* PDF Refresh */}
        <Tooltip content="Refresh PDF View">
          <button
            onClick={onRefreshPdf}
            className="h-7 w-7 rounded text-neutral-400 hover:text-neutral-200 bg-[#1b1d24] hover:bg-[#242732] border border-[#272933] flex items-center justify-center transition-colors"
          >
            <RotateCw size={12} />
          </button>
        </Tooltip>

        {/* Compiler status indicator */}
        <div className="flex items-center pl-1">
          {isCompiling ? (
            <span className="text-[11px] text-neutral-400 font-mono">Compiling...</span>
          ) : hasErrors ? (
            <div className="flex items-center gap-1 text-[11px] text-rose-400 font-mono">
              <AlertCircle size={13} />
              <span>Errors</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 size={13} />
              <span>Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Right section: Panel toggles & Settings */}
      <div className="flex items-center gap-1">
        <Tooltip content="Diagnostics Panel" shortcut="⇧⌘D">
          <button
            onClick={onToggleDiagnostics}
            className={`h-7 px-2 rounded text-xs flex items-center gap-1.5 border transition-colors ${
              isDiagnosticsOpen
                ? 'bg-[#22252e] text-neutral-200 border-[#323642]'
                : 'text-neutral-400 hover:text-neutral-200 bg-[#17181f] border-transparent hover:border-[#272933]'
            }`}
          >
            <Terminal size={13} />
            <span className="text-[11px]">Diagnostics</span>
          </button>
        </Tooltip>

        <Tooltip content="Agent Chat Panel" shortcut="⌘J">
          <button
            onClick={onToggleAgent}
            className={`h-7 px-2 rounded text-xs flex items-center gap-1.5 border transition-colors ${
              isAgentOpen
                ? 'bg-[#22252e] text-blue-400 border-[#323642]'
                : 'text-neutral-400 hover:text-neutral-200 bg-[#17181f] border-transparent hover:border-[#272933]'
            }`}
          >
            <Bot size={13} />
            <span className="text-[11px]">Agent</span>
          </button>
        </Tooltip>

        <div className="h-3.5 w-px bg-[#262832] mx-1" />

        <Tooltip content="Settings" shortcut="⌘,">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1d24] transition-colors"
          >
            <Settings size={14} />
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
