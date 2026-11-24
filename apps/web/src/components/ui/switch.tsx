'use client';

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  /** Accessible name when there is no visible label (e.g. a table cell). */
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  ariaLabel,
  disabled = false,
  id,
  className = '',
}) => {
  const switchId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`flex items-start justify-between gap-3 text-start select-none ${className}`}>
      {(label || description) && (
        <div className="flex flex-col flex-1">
          {label && (
            <label
              htmlFor={switchId}
              className={`text-sm font-medium cursor-pointer text-fg ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => !disabled && onChange(!checked)}
            >
              {label}
            </label>
          )}
          {description && <span className="text-xs text-fg-muted mt-0.5">{description}</span>}
        </div>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-[28px] w-[46px] shrink-0 items-center cursor-pointer rounded-full border border-[var(--glass-border)] p-[2px] transition-colors duration-200 ease-in-out outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-surface-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-surface-raised shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? '-translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

