'use client';

import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn';
import { normalizeDigits } from '../../lib/format';
import { controlBase, controlError, controlNormal, FieldLabel, FieldMessage } from './field';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Icon at the inline start (right in RTL). */
  iconPrefix?: React.ReactNode;
  /** Icon or action at the inline end (left in RTL). */
  iconSuffix?: React.ReactNode;
  inputSize?: 'md' | 'lg';
}

const NUMERIC_TYPES = new Set(['number', 'tel']);
const NUMERIC_MODES = new Set(['numeric', 'decimal', 'tel']);

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, iconPrefix, iconSuffix, inputSize = 'md', className = '', id, onChange, type, inputMode, ...props },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id || autoId;
    const msgId = `${inputId}-msg`;
    const numeric = NUMERIC_TYPES.has(type ?? '') || NUMERIC_MODES.has(inputMode ?? '');

    // OD-17: accept Arabic-Indic digits; the app and API always receive 0-9.
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      if (numeric) {
        const normalized = normalizeDigits(e.target.value);
        if (normalized !== e.target.value) e.target.value = normalized;
      }
      onChange?.(e);
    };

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <FieldLabel htmlFor={inputId} required={props.required}>
            {label}
          </FieldLabel>
        )}
        <div className="relative flex items-center">
          {iconPrefix && (
            <span className="pointer-events-none absolute start-3 flex items-center text-fg-subtle">{iconPrefix}</span>
          )}
          <input
            id={inputId}
            ref={ref}
            type={type}
            inputMode={inputMode}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? msgId : undefined}
            onChange={handleChange}
            className={cn(
              controlBase,
              error ? controlError : controlNormal,
              inputSize === 'lg' ? 'h-12 px-4' : 'h-10 px-3.5',
              iconPrefix && 'ps-10',
              iconSuffix && 'pe-10',
              className,
            )}
            {...props}
          />
          {iconSuffix && <span className="absolute end-3 flex items-center text-fg-subtle">{iconSuffix}</span>}
        </div>
        <FieldMessage id={msgId} error={error} helperText={helperText} />
      </div>
    );
  },
);
Input.displayName = 'Input';
