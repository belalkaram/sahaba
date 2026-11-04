'use client';

import React, { useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { usePresence, useDialogFocus } from '../../lib/motion/presence';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
};

/** Side panel that slides in from the inline start edge (the right in RTL). */
export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, subtitle, children, footer, width = 'md' }) => {
  const titleId = useId();
  const { rendered, backdropRef, panelRef } = usePresence(isOpen, { panelFrom: { xPercent: 100 } });
  useDialogFocus(isOpen, panelRef, onClose);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[70] flex overflow-hidden">
      <div ref={backdropRef} className="fixed inset-0 bg-surface-overlay backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex h-full w-full flex-col border-e border-border bg-surface-raised shadow-xl outline-none',
          widthClasses[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-fg">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            className="-me-2 grid h-9 w-9 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            aria-label="إغلاق"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-sunken px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
};
