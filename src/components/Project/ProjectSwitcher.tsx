import React, { useState, useRef, useEffect } from 'react';
import {
  FolderKanban,
  ChevronDown,
  Plus,
  FileText,
  Presentation,
  FileCode,
  Trash2,
  Check,
  FolderOpen,
  Upload,
  Download,
} from 'lucide-react';
import { ProjectSummary } from '../../types/project';
import { Modal } from '../common/Modal';

function timeAgo(ms: number): string {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)}h ago`;
  if (min < 60 * 24 * 30) return `${Math.round(min / 1440)}d ago`;
  return new Date(ms).toLocaleDateString();
}

interface ProjectSwitcherProps {
  currentProject: ProjectSummary | null;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, template: string) => void;
  onDeleteProject: (projectId: string) => void;
  onImportProject: (file: File) => void;
  isDirty: boolean;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onImportProject,
  isDirty,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'article' | 'beamer' | 'blank'>('article');

  const menuRef = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), selectedTemplate);
    setNewProjectName('');
    setIsNewModalOpen(false);
    setIsOpen(false);
  };

  const getTemplateBadge = (template: string) => {
    switch (template) {
      case 'beamer':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/40 flex items-center gap-1">
            <Presentation size={10} />
            <span>Beamer</span>
          </span>
        );
      case 'blank':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
            <FileCode size={10} />
            <span>Blank</span>
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/40 text-blue-300 border border-blue-800/40 flex items-center gap-1">
            <FileText size={10} />
            <span>Article</span>
          </span>
        );
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded bg-[#181a22] hover:bg-[#20222e] border border-[#272935] text-xs font-mono text-neutral-200 transition-colors"
      >
        <FolderKanban size={13} className="text-blue-400" />
        <span className="font-medium max-w-[160px] truncate">
          {currentProject ? currentProject.name : 'Select Project'}
        </span>
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" title="Unsaved changes" />
        )}
        <ChevronDown size={12} className="text-neutral-500" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#16171f] border border-[#262835] rounded shadow-xl py-1 z-50 text-xs font-mono">
          <div className="px-3 py-1.5 border-b border-[#242633] flex items-center justify-between text-[11px] text-neutral-400">
            <span>User Projects ({projects.length})</span>
            <button
              onClick={() => {
                setIsNewModalOpen(true);
                setIsOpen(false);
              }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>


          <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
            {projects.map((p) => {
              const isActive = currentProject?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`px-2.5 py-1.5 flex items-center justify-between group cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-950/40 text-blue-200'
                      : 'hover:bg-[#1f212c] text-neutral-300'
                  }`}
                  onClick={() => {
                    onSelectProject(p.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {isActive ? (
                      <Check size={13} className="text-blue-400 shrink-0" />
                    ) : (
                      <FolderOpen size={13} className="text-neutral-500 shrink-0 group-hover:text-neutral-300" />
                    )}
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-[10px] text-neutral-500 shrink-0" title={new Date(p.updatedAt).toLocaleString()}>
                      {timeAgo(p.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {getTemplateBadge(p.template)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${p.name}"? This permanently removes its files and agent history.`)) {
                          onDeleteProject(p.id);
                        }
                      }}
                      className="p-1 rounded hover:bg-rose-950/60 hover:text-rose-400 text-neutral-600 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-1.5 border-t border-[#242633] space-y-1">
            <button
              onClick={() => {
                setIsNewModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full py-1.5 px-2 rounded bg-[#20222e] hover:bg-[#282b3a] text-blue-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus size={13} />
              <span>Create New Project...</span>
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => importInput.current?.click()}
                className="flex-1 py-1.5 px-2 rounded hover:bg-[#20222e] text-neutral-300 flex items-center justify-center gap-1.5 transition-colors"
                title="Create a project from a .zip (e.g. an Overleaf download)"
              >
                <Upload size={12} />
                <span>Import .zip</span>
              </button>
              {currentProject && (
                <a
                  href={`/api/projects/download?id=${encodeURIComponent(currentProject.id)}`}
                  download
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-1.5 px-2 rounded hover:bg-[#20222e] text-neutral-300 flex items-center justify-center gap-1.5 transition-colors"
                  title="Download this project as .zip"
                >
                  <Download size={12} />
                  <span>Export .zip</span>
                </a>
              )}
            </div>
            <input
              ref={importInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportProject(file);
                  setIsOpen(false);
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>
      )}

      {/* New Project Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create New LaTeX Project"
        width="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. NeurIPS 2026 Paper or Chapter 1"
              required
              autoFocus
              className="w-full bg-[#121318] text-neutral-200 border border-[#272935] rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-2">Select Template</label>
            <div className="grid grid-cols-1 gap-2">
              {/* Template 1: Article */}
              <div
                onClick={() => setSelectedTemplate('article')}
                className={`p-3 rounded border cursor-pointer transition-all flex items-start gap-3 ${
                  selectedTemplate === 'article'
                    ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30'
                    : 'bg-[#14151c] border-[#252834] hover:border-[#353849]'
                }`}
              >
                <div className="p-2 rounded bg-blue-900/30 text-blue-400 mt-0.5">
                  <FileText size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-200 flex items-center justify-between">
                    <span>Research Article</span>
                    <span className="text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Clean academic paper with abstract, math environments, booktabs table, and references.bib.
                  </p>
                </div>
              </div>

              {/* Template 2: Beamer */}
              <div
                onClick={() => setSelectedTemplate('beamer')}
                className={`p-3 rounded border cursor-pointer transition-all flex items-start gap-3 ${
                  selectedTemplate === 'beamer'
                    ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-[#14151c] border-[#252834] hover:border-[#353849]'
                }`}
              >
                <div className="p-2 rounded bg-amber-900/30 text-amber-400 mt-0.5">
                  <Presentation size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-200 flex items-center justify-between">
                    <span>Beamer Slide Deck</span>
                    <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                      16:9 Madrid
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Complies with Beamer skill hard rules: 16:9, Madrid theme, semantic colors, columns, TikZ diagrams.
                  </p>
                </div>
              </div>

              {/* Template 3: Blank */}
              <div
                onClick={() => setSelectedTemplate('blank')}
                className={`p-3 rounded border cursor-pointer transition-all flex items-start gap-3 ${
                  selectedTemplate === 'blank'
                    ? 'bg-neutral-800 border-neutral-500/60 ring-1 ring-neutral-400/30'
                    : 'bg-[#14151c] border-[#252834] hover:border-[#353849]'
                }`}
              >
                <div className="p-2 rounded bg-neutral-800 text-neutral-300 mt-0.5">
                  <FileCode size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-200">Blank Document</div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Minimal blank LaTeX skeleton with article documentclass ready for your custom code.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232530]">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-3 py-1.5 rounded bg-[#20222c] hover:bg-[#282a38] text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
