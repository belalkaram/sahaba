'use client';

import React, { forwardRef } from 'react';

import { TriangleAlert } from 'lucide-react';
export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, description, error, className = '', id, disabled, ...props }, ref) => {
    const radioId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start gap-2.5 text-start select-none">
        <div className="relative flex items-center pt-0.5">
          <input
            id={radioId}
            type="radio"
            ref={ref}
            disabled={disabled}
            className={`peer h-4.5 w-4.5 shrink-0 appearance-none rounded-full border bg-surface transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 checked:border-primary checked:border-[5px] disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? 'border-danger' : 'border-border-strong hover:border-primary'
            } ${className}`}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={radioId}
                className={`text-sm font-medium cursor-pointer text-fg ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {label}
              </label>
            )}
            {description && <span className="text-xs text-fg-muted mt-0.5">{description}</span>}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  label,
  error,
  disabled,
  className = '',
}) => {
  return (
    <div className={`space-y-2 text-start ${className}`}>
      {label && <span className="block text-xs font-semibold text-fg">{label}</span>}
      <div className="space-y-2">
        {options.map((opt) => (
          <Radio
            key={opt.value}
            id={`${name}-${opt.value}`}
            name={name}
            value={opt.value}
            label={opt.label}
            description={opt.description}
            checked={value === opt.value}
            disabled={disabled || opt.disabled}
            onChange={(e) => onChange && onChange(e.target.value)}
          />
        ))}
      </div>
      {error && (
        <p className="text-xs font-medium text-danger mt-1 flex items-center gap-1">
          <span><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /></span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

