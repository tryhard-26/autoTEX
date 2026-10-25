import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

// Minimal Markdown for agent replies: fenced code blocks, inline `code`, **bold**.
// ponytail: no lists/headings/links; swap in a real Markdown lib if replies need them.

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group/code my-1.5">
      <pre className="bg-[#101116] border border-[#262833] rounded p-2 pr-14 overflow-x-auto text-[11.5px] leading-relaxed whitespace-pre">
        {code}
      </pre>
      <button
        onClick={async () => {
          if (await copyToClipboard(code)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-[#1c1e28] text-neutral-400 hover:text-neutral-200 border border-[#2b2d3d] flex items-center gap-1 opacity-0 group-hover/code:opacity-100"
        title={`Copy ${lang || 'code'}`}
      >
        {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={`${keyPrefix}-${i}`} className="px-1 rounded bg-[#1d1f28] text-[#c6a0f0]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const segments = text.split(/```([\w-]*)\n?([\s\S]*?)(?:```|$)/g);
  const out: React.ReactNode[] = [];
  // split() with 2 capture groups yields [text, lang, code, text, lang, code, ...]
  for (let i = 0; i < segments.length; i += 3) {
    if (segments[i]) out.push(<span key={`t${i}`}>{inline(segments[i]!, `t${i}`)}</span>);
    if (i + 2 < segments.length) out.push(<CodeBlock key={`c${i}`} lang={segments[i + 1] ?? ''} code={(segments[i + 2] ?? '').replace(/\n$/, '')} />);
  }
  return <div className="whitespace-pre-wrap">{out}</div>;
};
