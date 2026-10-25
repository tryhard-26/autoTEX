import React from 'react';
import { Modal } from '../common/Modal';
import { AppSettings } from '../../types/settings';
import { CompilerEngine } from '../../types/compiler';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  agentConnected: boolean;
  agentModel: string;
  onRetryAgent: () => void;
  onDeleteStoredSessions: () => Promise<boolean>;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  agentConnected,
  agentModel,
  onRetryAgent,
  onDeleteStoredSessions,
}) => {
  const [deleted, setDeleted] = React.useState(false);
  const setAgent = (patch: Partial<AppSettings['agent']>) =>
    setLocalSettings((prev) => ({ ...prev, agent: { ...prev.agent, ...patch } }));
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="max-w-xl">
      <div className="space-y-5 font-mono text-xs text-neutral-300">
        {/* Editor Settings */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2.5 pb-1 border-b border-[#252834]">
            Editor
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1">Font Size (px)</label>
              <input
                type="number"
                min="10"
                max="24"
                value={localSettings.editor.fontSize}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    editor: { ...localSettings.editor, fontSize: parseInt(e.target.value, 10) || 13 },
                  })
                }
                className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Tab Size</label>
              <select
                value={localSettings.editor.tabSize}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    editor: { ...localSettings.editor, tabSize: parseInt(e.target.value, 10) || 2 },
                  })
                }
                className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Line Wrapping</label>
              <select
                value={localSettings.editor.wordWrap}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    editor: { ...localSettings.editor, wordWrap: e.target.value as 'on' | 'off' },
                  })
                }
                className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="on">On (Soft wrap)</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Line Numbers</label>
              <select
                value={localSettings.editor.lineNumbers}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    editor: { ...localSettings.editor, lineNumbers: e.target.value as 'on' | 'off' },
                  })
                }
                className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="on">Show line numbers</option>
                <option value="off">Hide</option>
              </select>
            </div>
          </div>
        </div>

        {/* LaTeX Compilation Settings */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2.5 pb-1 border-b border-[#252834]">
            LaTeX Compiler
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1">Compiler Engine</label>
              <select
                value={localSettings.compiler.engine}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    compiler: {
                      ...localSettings.compiler,
                      engine: e.target.value as CompilerEngine,
                    },
                  })
                }
                className="w-full bg-[#13141a] border border-[#272935] rounded px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="tectonic">tectonic (Modern, self-contained)</option>
                <option value="pdflatex">pdflatex (Standard)</option>
                <option value="xelatex">xelatex (XeTeX / UTF-8)</option>
                <option value="lualatex">lualatex</option>
                <option value="latexmk">latexmk (Multi-pass)</option>
              </select>
            </div>

          </div>
        </div>

        {/* Agent Settings */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2.5 pb-1 border-b border-[#252834]">
            Agent (opencode)
          </h3>
          <div className="flex items-center justify-between gap-3 p-2 rounded bg-[#14151b] border border-[#232530]">
            <div className="min-w-0">
              <div className={agentConnected ? 'text-emerald-400' : 'text-rose-300'}>
                {agentConnected ? 'opencode found' : 'opencode not found'}
              </div>
              <div className="text-[11px] text-neutral-500 truncate" title={agentModel}>
                {agentConnected ? `default model: ${agentModel || 'unknown'}` : 'install it with: bun add -g opencode-ai'}
              </div>
            </div>
            <button
              onClick={onRetryAgent}
              className="px-2.5 py-1 rounded bg-[#1f212a] hover:bg-[#282a35] text-neutral-300 shrink-0"
            >
              Retry
            </button>
          </div>

          <div className="mt-3">
            <div className="space-y-1.5 pt-1">
              {(
                [
                  ['showThinking', 'Show thinking'],
                  ['highlightChanges', 'Highlight agent changes in editor'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={localSettings.agent[key]}
                    onChange={(e) => setAgent({ [key]: e.target.checked })}
                    className="accent-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2 text-[11px] text-neutral-500">
            <span>
              Conversations are saved automatically per project in .autotex/ and never deleted automatically. New
              conversation archives the previous one.
            </span>
            <button
              onClick={async () => {
                if (await onDeleteStoredSessions()) {
                  setDeleted(true);
                  setTimeout(() => setDeleted(false), 1500);
                }
              }}
              className="px-2 py-0.5 rounded bg-[#1f212a] hover:bg-rose-950/60 text-rose-300 shrink-0"
            >
              {deleted ? 'Deleted' : 'Delete saved conversations…'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252834]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#1f212a] hover:bg-[#282a35] text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
};
