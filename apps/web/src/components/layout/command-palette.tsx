'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { NavItem } from '../../config/navigation-registry';
import { NAV_GROUP_LABELS } from '../../config/navigation-registry';
import { navIcon } from '../../config/nav-icons';
import { cn } from '../../lib/cn';
import { usePresence } from '../../lib/motion/presence';

/** Normalizes Arabic letter variants so «اختبار» matches «إختبار» and «ة» matches «ه». */
function normalizeArabic(text: string) {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '');
}

/** Quick navigation across the pages this user can access (Ctrl/⌘+K). */
export function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  onSelect: (href: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { rendered, backdropRef, panelRef } = usePresence(open, { panelFrom: { y: -8, scale: 0.98 } });

  const results = useMemo(() => {
    const q = normalizeArabic(query.trim());
    if (!q) return items;
    return items.filter((i) => normalizeArabic(`${i.label} ${NAV_GROUP_LABELS[i.group]}`).includes(q));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!rendered) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[index]) onSelect(results[index].href);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center px-4 pt-[12vh]">
      <div ref={backdropRef} className="fixed inset-0 bg-surface-overlay backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="انتقال سريع"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب اسم الصفحة…"
            className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            aria-label="ابحث عن صفحة"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-fg-muted">لا توجد صفحة بهذا الاسم</li>}
          {results.map((item, i) => {
            const Icon = navIcon(item.iconName);
            return (
              <li key={item.id} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onSelect(item.href)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-sm transition-colors',
                    i === index ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg',
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-fg-subtle">{NAV_GROUP_LABELS[item.group]}</span>
                  {i === index && <CornerDownLeft size={14} className="text-fg-subtle" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
