import React, { useState } from 'react';
import { DiagnosticItem } from '../../types/compiler';
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ArrowUpRight,
  Copy,
  Check,
  Bot,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

interface DiagnosticsPanelProps {
  errors: DiagnosticItem[];
  warnings: DiagnosticItem[];
  fullLog: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLine: (file: string, line: number) => void;
  onAskAgent?: (prompt: string) => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  errors,
  warnings,
  fullLog,
  isOpen,
  onClose,
  onNavigateToLine,
  onAskAgent,
}) => {
  const [activeTab, setActiveTab] = useState<'errors' | 'warnings' | 'log'>('errors');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopySingle = async (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyAllErrors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = errors.map((err) => `${err.file}:${err.line}: ${err.message}`).join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId('all-errors');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyAllWarnings = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = warnings.map((w) => `${w.file}:${w.line}: ${w.message}`).join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId('all-warnings');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyFullLog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(fullLog);
    if (success) {
      setCopiedId('full-log');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFixWithAgent = (err: DiagnosticItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAskAgent) {
      onAskAgent(
        `Please fix this LaTeX error in ${err.file} at line ${err.line}:\n"${err.message}"`
      );
    }
  };

  return (
    <div className="h-60 bg-[#14151a] border-t border-[#20222a] flex flex-col font-mono text-xs shrink-0 select-text">
      {/* Diagnostics Header & Tabs */}
      <div className="h-8 border-b border-[#20222a] bg-[#121318] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('errors')}
            className={`h-full px-2 text-[11px] flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'errors'
                ? 'border-rose-500 text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlertCircle size={12} className="text-rose-400" />
            <span>Errors ({errors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('warnings')}
            className={`h-full px-2 text-[11px] flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'warnings'
                ? 'border-amber-500 text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlertTriangle size={12} className="text-amber-400" />
            <span>Warnings ({warnings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('log')}
            className={`h-full px-2 text-[11px] flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'log'
                ? 'border-blue-500 text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText size={12} className="text-neutral-400" />
            <span>Full Log</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Copy Action for active tab */}
          {activeTab === 'errors' && errors.length > 0 && (
            <button
              onClick={handleCopyAllErrors}
              className="px-2 py-0.5 rounded bg-[#1e2029] hover:bg-[#282b38] text-neutral-300 text-[11px] flex items-center gap-1 transition-colors border border-[#2b2d3b]"
              title="Copy all error messages to clipboard"
            >
              {copiedId === 'all-errors' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied All</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy All Errors</span>
                </>
              )}
            </button>
          )}

          {activeTab === 'warnings' && warnings.length > 0 && (
            <button
              onClick={handleCopyAllWarnings}
              className="px-2 py-0.5 rounded bg-[#1e2029] hover:bg-[#282b38] text-neutral-300 text-[11px] flex items-center gap-1 transition-colors border border-[#2b2d3b]"
              title="Copy all warning messages to clipboard"
            >
              {copiedId === 'all-warnings' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied All</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Warnings</span>
                </>
              )}
            </button>
          )}

          {activeTab === 'log' && fullLog && (
            <button
              onClick={handleCopyFullLog}
              className="px-2 py-0.5 rounded bg-[#1e2029] hover:bg-[#282b38] text-neutral-300 text-[11px] flex items-center gap-1 transition-colors border border-[#2b2d3b]"
              title="Copy full compiler output"
            >
              {copiedId === 'full-log' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied Log</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Full Log</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a] transition-colors"
            title="Close diagnostics"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-2 select-text">
        {activeTab === 'errors' && (
          <div className="space-y-1">
            {errors.length === 0 ? (
              <div className="text-neutral-500 py-4 text-center text-[11px]">
                No errors detected · Document builds cleanly
              </div>
            ) : (
              errors.map((err, idx) => {
                const errKey = `err-${idx}`;
                const errFormatted = `${err.file}:${err.line}: ${err.message}`;
                const isCopied = copiedId === errKey;

                return (
                  <div
                    key={idx}
                    onClick={() => onNavigateToLine(err.file, err.line)}
                    className="px-2.5 py-1.5 rounded hover:bg-[#1e2029] cursor-pointer flex items-center justify-between text-neutral-300 border border-transparent hover:border-[#2a2c38] transition-colors group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 select-text">
                      <span className="text-rose-400 shrink-0 font-bold">!</span>
                      <span className="text-neutral-400 font-medium shrink-0 select-text">
                        {err.file}:{err.line}
                      </span>
                      <span className="text-neutral-200 truncate select-text">{err.message}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      {/* Copy individual error */}
                      <button
                        onClick={(e) => handleCopySingle(errFormatted, errKey, e)}
                        className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
                          isCopied
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                            : 'bg-[#181a22] hover:bg-[#262835] text-neutral-400 hover:text-neutral-200 border border-[#262835]'
                        }`}
                        title="Copy error message to clipboard"
                      >
                        {isCopied ? <Check size={11} /> : <Copy size={11} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      {/* Ask Agent to fix error */}
                      {onAskAgent && (
                        <button
                          onClick={(e) => handleFixWithAgent(err, e)}
                          className="px-2 py-0.5 rounded text-[11px] bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 flex items-center gap-1 transition-colors"
                          title="Ask the agent to fix this error"
                        >
                          <Bot size={11} />
                          <span>Fix with Agent</span>
                        </button>
                      )}

                      {/* Jump to Line in Editor */}
                      <div className="flex items-center gap-1 text-neutral-500 group-hover:text-blue-400 text-[11px] px-1">
                        <span>Jump</span>
                        <ArrowUpRight size={11} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'warnings' && (
          <div className="space-y-1">
            {warnings.length === 0 ? (
              <div className="text-neutral-500 py-4 text-center text-[11px]">No warnings detected</div>
            ) : (
              warnings.map((warn, idx) => {
                const warnKey = `warn-${idx}`;
                const warnFormatted = `${warn.file}:${warn.line}: ${warn.message}`;
                const isCopied = copiedId === warnKey;

                return (
                  <div
                    key={idx}
                    onClick={() => onNavigateToLine(warn.file, warn.line)}
                    className="px-2.5 py-1.5 rounded hover:bg-[#1e2029] cursor-pointer flex items-center justify-between text-neutral-300 border border-transparent hover:border-[#2a2c38] transition-colors group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 select-text">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                      <span className="text-neutral-400 font-medium shrink-0 select-text">
                        {warn.file}:{warn.line}
                      </span>
                      <span className="text-neutral-300 truncate select-text">{warn.message}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <button
                        onClick={(e) => handleCopySingle(warnFormatted, warnKey, e)}
                        className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
                          isCopied
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                            : 'bg-[#181a22] hover:bg-[#262835] text-neutral-400 hover:text-neutral-200 border border-[#262835]'
                        }`}
                        title="Copy warning message"
                      >
                        {isCopied ? <Check size={11} /> : <Copy size={11} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      <div className="flex items-center gap-1 text-neutral-500 group-hover:text-amber-400 text-[11px] px-1">
                        <span>Jump</span>
                        <ArrowUpRight size={11} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <pre className="text-[11px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed select-text p-2 bg-[#101115] rounded border border-[#22242f]">
            {fullLog || 'No compiler log available.'}
          </pre>
        )}
      </div>
    </div>
  );
};
