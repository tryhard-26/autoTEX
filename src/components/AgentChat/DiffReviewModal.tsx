import React from 'react';
import { Modal } from '../common/Modal';
import { AgentFileEdit } from '../../types/agent';
import { Check, RotateCcw } from 'lucide-react';

interface DiffReviewModalProps {
  edit: AgentFileEdit | null;
  onClose: () => void;
  onAccept: (editId: string) => void;
  onRevert: (editId: string) => void;
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  edit,
  onClose,
  onAccept,
  onRevert,
}) => {
  if (!edit) return null;

  const diffLines = edit.diffText.split('\n');

  return (
    <Modal isOpen={!!edit} onClose={onClose} title={`Review Edit: ${edit.file}`} width="max-w-2xl">
      <div className="flex flex-col gap-3">
        {/* Diff header summary */}
        <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#252834]">
          <span className="text-neutral-400">{edit.file}</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-medium">+{edit.additions}</span>
            <span className="text-rose-400 font-medium">-{edit.deletions}</span>
          </div>
        </div>

        {/* Diff text view */}
        <div className="bg-[#121318] border border-[#232530] rounded p-2 overflow-x-auto max-h-[50vh] font-mono text-xs leading-relaxed">
          {diffLines.map((line, idx) => {
            let lineClass = 'text-neutral-400';
            let bgClass = '';
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-emerald-300';
              bgClass = 'bg-emerald-950/30';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-rose-300';
              bgClass = 'bg-rose-950/30';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-blue-400 font-semibold';
              bgClass = 'bg-blue-950/20';
            }

            return (
              <div key={idx} className={`px-1 rounded-xs whitespace-pre ${lineClass} ${bgClass}`}>
                {line || ' '}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252834]">
          <button
            onClick={() => {
              onRevert(edit.id);
              onClose();
            }}
            className="px-3 py-1.5 rounded text-xs font-mono bg-[#20222c] hover:bg-[#282b38] text-rose-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={12} />
            <span>Revert</span>
          </button>
          <button
            onClick={() => {
              onAccept(edit.id);
              onClose();
            }}
            className="px-3 py-1.5 rounded text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors"
          >
            <Check size={12} />
            <span>Keep</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
