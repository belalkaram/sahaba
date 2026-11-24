'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/theme-context';
import { cn } from '../../lib/cn';

/**
 * One-click light/dark toggle (no menu, so nothing can be clipped by the floating glass bars).
 * First visit still follows the device ("system" until the user clicks); a click stores the choice.
 */
export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg',
        className,
      )}
    >
      <Icon key={isDark ? 'dark' : 'light'} size={18} strokeWidth={1.75} className="animate-in fade-in zoom-in-75 duration-200" aria-hidden />
    </button>
  );
}
