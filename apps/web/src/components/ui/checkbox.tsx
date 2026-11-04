'use client';

import React, { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, helperText, error, indeterminate, className = '', id, checked, disabled, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    const setMergedRef = (element: HTMLInputElement | null) => {
      inputRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = element;
      }
    };

    return (
      <div className="flex items-start gap-2.5 text-start select-none">
        <div className="relative flex items-center pt-0.5">
          <input
            id={checkboxId}
            type="checkbox"
            ref={setMergedRef}
            checked={checked}
            disabled={disabled}
            className={`peer h-4.5 w-4.5 shrink-0 appearance-none rounded border bg-surface transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 checked:bg-primary checked:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? 'border-danger' : 'border-border-strong hover:border-primary'
            } ${className}`}
            {...props}
          />
          <svg
            className="pointer-events-none absolute inset-0 m-auto h-3 w-3 stroke-primary-fg opacity-0 transition-opacity peer-checked:opacity-100 peer-indeterminate:hidden"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {indeterminate && (
            <svg
              className="pointer-events-none absolute inset-0 m-auto h-3 w-3 stroke-primary-fg opacity-100"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="3"
              stroke="currentColor"
            >
              <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
            </svg>
          )}
        </div>
        {(label || helperText || error) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={checkboxId}
                className={`text-sm font-medium cursor-pointer text-fg ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {label}
              </label>
            )}
            {helperText && <span className="text-xs text-fg-muted mt-0.5">{helperText}</span>}
            {error && <span className="text-xs text-danger font-medium mt-0.5">{error}</span>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

