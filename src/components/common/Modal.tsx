import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div
        className={`w-full ${width} bg-[#17181d] border border-[#272932] rounded-md shadow-2xl flex flex-col overflow-hidden text-neutral-200 animate-in fade-in zoom-in-95 duration-100`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#23252d] bg-[#14151a]">
          <h2 className="text-xs font-mono font-medium text-neutral-300 uppercase tracking-wider">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#20222a] transition-colors"
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
};
