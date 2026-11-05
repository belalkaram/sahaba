'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DropdownMenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  dividerBefore?: boolean;
  description?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block text-start', className)} ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'absolute z-50 mt-1.5 min-w-[200px] rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150',
            align === 'right' ? 'start-0' : 'end-0',
          )}
        >
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.dividerBefore && <div className="my-1 border-t border-border" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick?.();
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-start transition-colors',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed text-fg-muted pointer-events-none'
                    : item.selected
                    ? 'bg-primary-subtle text-primary-subtle-fg font-bold'
                    : item.danger
                    ? 'text-danger hover:bg-danger-subtle'
                    : 'text-fg hover:bg-surface-muted',
                )}
              >
                {item.icon && <span className="shrink-0 text-current">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{item.label}</span>
                    {item.badge && <span className="ms-auto shrink-0">{item.badge}</span>}
                  </div>
                  {item.description && (
                    <p className="text-[11px] font-normal text-fg-muted mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.selected && (
                  <Check size={14} className="shrink-0 text-primary ms-1" strokeWidth={2.5} aria-hidden />
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
