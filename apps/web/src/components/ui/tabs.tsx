'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import { gsap, MOTION, prefersReducedMotion } from '../../lib/motion';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

/** Tabs with an indicator that slides to the active tab (RTL-aware: measured, not computed). */
export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '', variant = 'pill' }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const firstRun = useRef(true);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    const active = list?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeTab)}"]`);
    if (!list || !indicator || !active) return;
    const vars = { x: active.offsetLeft, width: active.offsetWidth };
    if (firstRun.current || prefersReducedMotion()) {
      gsap.set(indicator, vars);
      firstRun.current = false;
    } else {
      gsap.to(indicator, { ...vars, duration: MOTION.duration.base, ease: MOTION.ease.out });
    }
  }, [activeTab, tabs.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    // RTL: ArrowLeft moves to the next tab, ArrowRight to the previous one.
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === nextKey) onChange(tabs[(idx + 1) % tabs.length].id);
    if (e.key === prevKey) onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
  };

  const underline = variant === 'underline';

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex max-w-full items-center overflow-x-auto',
        underline ? 'gap-6 border-b border-border' : 'inline-flex gap-1 rounded-lg border border-border bg-surface-muted p-1',
        className,
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0',
          underline ? 'bottom-0 h-0.5 rounded-full bg-primary' : 'top-1 bottom-1 rounded-md bg-surface shadow-sm',
        )}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors',
              underline ? 'pb-3' : 'h-9 rounded-md px-3.5',
              isActive ? (underline ? 'text-primary' : 'text-fg') : 'text-fg-muted hover:text-fg',
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-xs font-bold',
                  isActive ? 'bg-primary-subtle text-primary-subtle-fg' : 'bg-surface text-fg-subtle',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
