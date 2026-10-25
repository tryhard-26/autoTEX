import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'bottom',
  shortcut,
}) => {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 pointer-events-none px-2 py-1 text-[11px] font-sans font-medium text-neutral-300 bg-[#1e2026] border border-[#2e313c] rounded shadow-md whitespace-nowrap flex items-center gap-1.5 ${positionClasses[position]}`}
          role="tooltip"
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="px-1 py-0.2 text-[10px] font-mono bg-[#14151a] text-neutral-400 border border-[#2d303a] rounded">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
