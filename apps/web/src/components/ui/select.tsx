'use client';

import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { controlBase, controlError, controlNormal, FieldLabel, FieldMessage } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, children, placeholder, error, helperText, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;
    const msgId = `${selectId}-msg`;
    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <FieldLabel htmlFor={selectId} required={props.required}>
            {label}
          </FieldLabel>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? msgId : undefined}
            className={cn(
              controlBase,
              error ? controlError : controlNormal,
              'h-10 appearance-none ps-3.5 pe-10 cursor-pointer text-sm font-medium transition-colors',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden className="text-fg-subtle bg-surface">
                {placeholder}
              </option>
            )}
            {options?.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-surface text-fg font-medium py-1.5 px-3 disabled:text-fg-muted disabled:bg-surface-muted"
              >
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-fg-subtle transition-transform duration-200"
            aria-hidden
          />
        </div>
        <FieldMessage id={msgId} error={error} helperText={helperText} />
      </div>
    );
  },
);
Select.displayName = 'Select';
