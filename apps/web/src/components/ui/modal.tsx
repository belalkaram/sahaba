'use client';

import React, { useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { usePresence, useDialogFocus } from '../../lib/motion/presence';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-[95vw] sm:h-[90vh]',
};

/** Centered dialog on desktop, bottom sheet on mobile. */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, footer, size = 'md' }) => {
  const titleId = useId();
  const { rendered, backdropRef, panelRef } = usePresence(isOpen);
  useDialogFocus(isOpen, panelRef, onClose);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div ref={backdropRef} className="fixed inset-0 bg-surface-overlay backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden border border-border bg-surface-raised shadow-xl outline-none',
          'rounded-t-xl sm:rounded-xl',
          sizeClasses[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
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
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
