'use client';

import React, { forwardRef } from 'react';

import { TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { controlBase, controlError, controlNormal } from './field';
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
          className={cn(controlBase, error ? controlError : controlNormal, 'px-4 py-3', className)}
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

