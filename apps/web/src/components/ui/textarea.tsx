'use client';

import React, { forwardRef } from 'react';

import { TriangleAlert } from 'lucide-react';
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-fg">
            {label}
            {props.required && <span className="text-danger ms-1">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-danger focus:ring-danger' : 'border-border'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium text-danger mt-1 flex items-center gap-1">
            <span><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /></span>
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-fg-muted mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

