import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Bot,
  User,
  Check,
  RotateCcw,
  Eye,
  FileCode,
  TextSelect,
  Plus,
  Undo2,
  Redo2,
  Brain,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  ScrollText,
} from 'lucide-react';
import { AgentMessage, AgentFileEdit, AgentSkillInfo } from '../../types/agent';
import { DiffReviewModal } from './DiffReviewModal';
import { copyToClipboard } from '../../utils/clipboard';
import { Markdown } from './Markdown';
import { ModelBar } from './ModelBar';
import { AgentLogs } from './AgentLogs';

interface AgentPanelProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onCancel: () => void;
  onAcceptEdit: (editId: string) => void;
  onRevertEdit: (editId: string) => void;
  currentSelection: {
    startLine: number;
    endLine: number;
    text: string;
  } | null;
  onClearSelection: () => void;
  skills: AgentSkillInfo[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewConversation: () => void;
  onUndoTurn: () => void;
  onRedoTurn: () => void;
  undoCount: number; // agent turns that can be undone (max 2)
  redoCount: number;
  showThinking: boolean;
  model: string;
  onChangeModel: (model: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  onCancel,
  onAcceptEdit,
  onRevertEdit,
  currentSelection,
  onClearSelection,
  skills,
  isCollapsed,
  onToggleCollapse,
  onNewConversation,
  onUndoTurn,
  onRedoTurn,
  undoCount,
  redoCount,
  showThinking,
  model,
  onChangeModel,
}) => {
  const [height, setHeight] = useState(256);
  const startResize = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => setHeight(Math.max(120, Math.min(window.innerHeight * 0.7, startH + startY - ev.clientY)));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [inputText, setInputText] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  // Ticks once a second while streaming so "Working… 42s" stays current.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isStreaming]);
  const [reviewingEdit, setReviewingEdit] = useState<AgentFileEdit | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopyMessage = async (content: string, id: string) => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col bg-[#14151a] border-t border-[#20222a] overflow-hidden relative">
      <div onMouseDown={startResize} className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/50 z-10" />
      {/* Panel Header */}
      <div className="h-8 px-3 border-b border-[#20222a] bg-[#121318] flex items-center justify-between text-xs font-mono text-neutral-400 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-blue-400" />
          <span
            className="text-[11px] uppercase tracking-wider font-semibold text-neutral-300"
            title={skills.length ? `Skills: ${skills.map((s) => s.name).join(', ')}` : undefined}
          >
            Agent
          </span>
          <ModelBar model={model} onChangeModel={onChangeModel} isStreaming={isStreaming} />
        </div>

        <div className="flex items-center gap-1">
        <button
          onClick={onUndoTurn}
          disabled={isStreaming || undoCount === 0}
          className="h-6 px-1.5 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a] disabled:opacity-30 flex items-center gap-1"
          title={`Undo the last agent turn's file changes (${undoCount} of 2 available)`}
        >
          <Undo2 size={12} />
          <span>{undoCount}</span>
        </button>
        <button
          onClick={onRedoTurn}
          disabled={isStreaming || redoCount === 0}
          className="h-6 px-1.5 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a] disabled:opacity-30 flex items-center gap-1"
          title={`Redo an undone agent turn (${redoCount} available)`}
        >
          <Redo2 size={12} />
          <span>{redoCount}</span>
        </button>
        <div className="h-3 w-px bg-[#262832] mx-0.5" />
        <button
          onClick={() => setShowLogs(true)}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a]"
          title="Agent log"
        >
          <ScrollText size={13} />
        </button>
        <button
          onClick={onNewConversation}
          disabled={isStreaming}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a] disabled:opacity-40"
          title="New conversation"
        >
          <Plus size={13} />
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f212a] transition-colors"
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        </div>
      </div>

      <AgentLogs isOpen={showLogs} onClose={() => setShowLogs(false)} />
      {!isCollapsed && (
        <div className="flex flex-col" style={{ height }}>
          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center font-mono text-neutral-500">
                <p className="text-[11px]">Ask about this project. Select text in the editor to work on it.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className="flex gap-2.5 group relative">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                        isUser
                          ? 'bg-[#252834] text-neutral-300'
                          : 'bg-blue-900/40 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isUser ? <User size={12} /> : <Bot size={12} />}
                    </div>

                    <div className="flex-1 overflow-hidden space-y-2 select-text">
                      {/* Thinking (model reasoning), streamed live, collapsed once the reply starts */}
                      {!isUser && showThinking && msg.thinking && (
                        <details open={msg.isStreaming && !msg.content} className="group/think text-[11px] font-mono">
                          <summary className="cursor-pointer select-none text-neutral-500 hover:text-neutral-300 flex items-center gap-1 list-none">
                            <Brain size={11} />
                            <span>{msg.isStreaming && !msg.content ? 'Thinking…' : 'Thought process'}</span>
                          </summary>
                          <div className="mt-1 pl-2 border-l border-[#2b2d3a] text-neutral-500 italic whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {msg.thinking}
                          </div>
                        </details>
                      )}

                      {/* Message Content */}
                      <div
                        className={`font-mono text-[12px] leading-relaxed select-text pr-14 ${
                          msg.undone ? 'text-neutral-500' : 'text-neutral-200'
                        }`}
                      >
                        {isUser ? <div className="whitespace-pre-wrap">{msg.content}</div> : <Markdown text={msg.content} />}
                        {msg.isStreaming && !msg.content && !(showThinking && msg.thinking) && (
                          <span className="text-neutral-500">
                            Working… {Math.max(0, Math.round((now - msg.timestamp) / 1000))}s
                            <button onClick={() => setShowLogs(true)} className="ml-2 underline hover:text-neutral-300">
                              view log
                            </button>
                          </span>
                        )}
                      </div>

                      {!isUser && !msg.isStreaming && (msg.durationMs || msg.undone) && (
                        <div className="text-[10px] font-mono text-neutral-600 flex items-center gap-2">
                          {msg.durationMs && <span>{(msg.durationMs / 1000).toFixed(1)}s</span>}
                          {msg.totalTokens ? <span>{msg.totalTokens.toLocaleString()} tokens</span> : null}
                          {msg.undone && <span className="text-amber-500/80">changes undone</span>}
                        </div>
                      )}

                      {/* Hover Copy Button */}
                      <button
                        onClick={() => handleCopyMessage(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-[#1c1e28] hover:bg-[#252836] text-neutral-400 hover:text-neutral-200 border border-[#2b2d3d] text-[10px] flex items-center gap-1 transition-all absolute right-0 top-0 shadow-sm"
                        title="Copy message text"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check size={10} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Compact Tool Activity (Section 10) */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {msg.toolCalls.map((tool) => (
                            <span
                              key={tool.id}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1c1d25] border border-[#282a35] flex items-center gap-1 ${
                                tool.status === 'failed' ? 'text-rose-300' : 'text-neutral-400'
                              }`}
                              title={tool.output}
                            >
                              <FileCode size={10} className="text-neutral-500" />
                              <span>{tool.summary}</span>
                              {tool.status === 'running' && <span className="text-neutral-500">…</span>}
                              {tool.status === 'failed' && <span>failed</span>}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Compact File Edit Cards (Section 11) */}
                      {msg.edits && msg.edits.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {msg.edits.map((edit) => (
                            <div
                              key={edit.id}
                              className="p-2 rounded bg-[#171820] border border-[#272935] flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-neutral-200 font-medium">{edit.file}</span>
                                <span className="text-emerald-400 text-[11px]">+{edit.additions}</span>
                                <span className="text-rose-400 text-[11px]">-{edit.deletions}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setReviewingEdit(edit)}
                                  className="px-2 py-0.5 rounded text-[11px] bg-[#222430] hover:bg-[#2c2f3e] text-neutral-300 flex items-center gap-1 transition-colors"
                                >
                                  <Eye size={11} />
                                  <span>Review</span>
                                </button>
                                {msg.undone ? (
                                  <span className="text-[11px] text-amber-500/80 px-1">Undone</span>
                                ) : edit.status === 'reverted' ? (
                                  <span className="text-[11px] text-rose-400 px-1">Reverted</span>
                                ) : edit.status === 'accepted' ? (
                                  <span className="text-[11px] text-emerald-400 px-1">Kept</span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => onAcceptEdit(edit.id)}
                                      className="px-2 py-0.5 rounded text-[11px] bg-blue-600/80 hover:bg-blue-600 text-white flex items-center gap-1 transition-colors"
                                    >
                                      <Check size={11} />
                                      <span>Keep</span>
                                    </button>
                                    <button
                                      onClick={() => onRevertEdit(edit.id)}
                                      className="px-2 py-0.5 rounded text-[11px] bg-[#20222c] hover:bg-[#2a2c3a] text-rose-300 flex items-center gap-1 transition-colors"
                                    >
                                      <RotateCcw size={11} />
                                      <span>Revert</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isUser && !msg.isStreaming && !isStreaming && /\n\nError: /.test(msg.content) && (
                        <button
                          onClick={() => {
                            const idx = messages.indexOf(msg);
                            const prompt = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
                            if (prompt) onSendMessage(prompt.content);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#222430] hover:bg-[#2c2f3e] text-neutral-300 flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Selection Banner if active */}
          {currentSelection && currentSelection.text.trim().length > 0 && (
            <div className="px-3 py-1 bg-blue-950/30 border-t border-blue-900/30 flex items-center justify-between text-[11px] font-mono text-blue-300 shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <TextSelect size={11} className="shrink-0" />
                <span className="truncate">
                  Selection: lines {currentSelection.startLine}–{currentSelection.endLine} ({currentSelection.text.length} chars)
                </span>
              </div>
              <button
                onClick={onClearSelection}
                className="p-0.5 rounded hover:bg-blue-900/40 text-blue-400"
                title="Clear selection context"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="p-2 border-t border-[#20222a] bg-[#121318] flex items-center gap-2 shrink-0"
          >
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentSelection
                  ? 'Instruction for the selection…'
                  : 'Ask about this project…'
              }
              rows={1}
              className="flex-1 bg-[#181921] text-neutral-200 border border-[#272935] rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none leading-normal"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="h-8 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-medium flex items-center gap-1 transition-colors"
                title="Cancel generation"
              >
                <Square size={11} className="fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="h-8 px-2.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-[#20222a] disabled:text-neutral-500 text-white text-xs font-mono font-medium flex items-center gap-1 transition-colors"
              >
                <Send size={11} />
                <span>Send</span>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Review Diff Modal */}
      <DiffReviewModal
        edit={reviewingEdit}
        onClose={() => setReviewingEdit(null)}
        onAccept={onAcceptEdit}
        onRevert={onRevertEdit}
      />
    </div>
  );
};
