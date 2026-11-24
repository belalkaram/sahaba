import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Shared control styling: inputs, selects and textareas share height, radius and states. */
export const controlBase =
  'w-full rounded-sm border bg-[var(--glass-bg-flat)] text-fg text-sm placeholder:text-fg-subtle shadow-[inset_0_1px_2px_var(--border-subtle)] ' +
  'transition-[border-color,box-shadow,background-color] duration-150 outline-none ' +
  'hover:border-border-strong focus:border-primary focus:bg-surface-raised focus:shadow-[var(--focus-ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-muted read-only:bg-surface-muted';

export const controlError = 'border-danger bg-danger-subtle focus:border-danger';
export const controlNormal = 'border-[var(--glass-border)]';

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-fg">
      {children}
      {required && (
        <span className="ms-1 text-danger" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export function FieldMessage({ id, error, helperText }: { id?: string; error?: string; helperText?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger">
        <AlertCircle size={14} aria-hidden />
        <span>{error}</span>
      </p>
    );
  }
  if (helperText) {
    return (
      <p id={id} className="text-xs text-fg-muted">
        {helperText}
      </p>
    );
  }
  return null;
}
