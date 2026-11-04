'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../../context/theme-context';
import { cn } from '../../lib/cn';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'فاتح', icon: Sun },
  { value: 'dark', label: 'داكن', icon: Moon },
  { value: 'system', label: 'حسب الجهاز', icon: Monitor },
];

/** Light / Dark / System. The choice persists; "system" follows the OS live. */
export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const CurrentIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="المظهر"
        title="المظهر"
        className="grid h-10 w-10 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <CurrentIcon size={18} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-md border border-border bg-surface-raised p-1 shadow-lg"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors',
                theme === value ? 'bg-primary-subtle text-primary-subtle-fg font-semibold' : 'text-fg hover:bg-surface-muted',
              )}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-start">{label}</span>
              {theme === value && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
