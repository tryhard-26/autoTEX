import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { copyToClipboard } from '../../utils/clipboard';

type LogLine = { seq: number; t: number; text: string };

/** Live agent log (requests, tool calls, opencode output), polled from the server while open. */
export const AgentLogs: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const last = useRef(-1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/logs?since=${last.current}`);
        const data = (await res.json()) as { lines: LogLine[]; running: boolean };
        if (stop) return;
        setRunning(data.running);
        if (data.lines.length) {
          last.current = data.lines[data.lines.length - 1]!.seq;
          setLines((prev) => [...prev, ...data.lines].slice(-2000));
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [isOpen]);

  useEffect(() => end.current?.scrollIntoView(), [lines]);

  const color = (text: string) =>
    /ERROR|level=ERROR|failed|No output/i.test(text)
      ? 'text-rose-400'
      : /^Prompt:|^Turn started|^Done/.test(text)
      ? 'text-blue-300'
      : /^tool /.test(text)
      ? 'text-emerald-400/90'
      : /rate limit|level=WARN/i.test(text)
      ? 'text-amber-400'
      : 'text-neutral-400';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agent log" width="max-w-4xl">
      <div className="flex items-center justify-between mb-2 text-[11px] font-mono text-neutral-500">
        <span>{running ? <span className="text-emerald-400">● agent running</span> : 'idle'} · updates every second</span>
        <button
          onClick={() => copyToClipboard(lines.map((l) => `${new Date(l.t).toLocaleTimeString()} ${l.text}`).join('\n'))}
          className="px-2 py-0.5 rounded bg-[#1f212a] hover:bg-[#282a35] text-neutral-300"
        >
          Copy all
        </button>
      </div>
      <div className="h-[60vh] overflow-auto bg-[#0f1014] border border-[#232530] rounded p-2 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 && <div className="text-neutral-600">Nothing logged yet. Send the agent a message.</div>}
        {lines.map((l) => (
          <div key={l.seq} className={`whitespace-pre-wrap break-all ${color(l.text)}`}>
            <span className="text-neutral-600 mr-2">{new Date(l.t).toLocaleTimeString()}</span>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </Modal>
  );
};
