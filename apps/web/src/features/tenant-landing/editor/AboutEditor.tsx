'use client';

/**
 * TL-6 (ADR-007): About section editor — plain text ≤ 1200 chars + 3 strength highlights.
 * No HTML accepted. Text sanitised on the server.
 */
import React from 'react';
import { cn } from '../../../lib/cn';

export interface AboutContent {
  text: string;
  highlights: string[];
}

interface Props {
  value: AboutContent;
  onChange: (v: AboutContent) => void;
}

const MAX_TEXT = 1200;
const HIGHLIGHT_LABELS = ['نقطة القوة الأولى', 'نقطة القوة الثانية', 'نقطة القوة الثالثة'];

export function AboutEditor({ value, onChange }: Props) {
  const remaining = MAX_TEXT - (value.text?.length ?? 0);

  const setHighlight = (i: number, v: string) => {
    const next = [...(value.highlights ?? [])];
    next[i] = v;
    onChange({ ...value, highlights: next });
  };

  return (
    <div className="space-y-5">
      {/* About text */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-fg" htmlFor="about-text">
          نص التعريف
          <span className="ms-1 text-xs font-normal text-fg-muted">— يظهر في قسم «عن الأكاديمية»</span>
        </label>
        <textarea
          id="about-text"
          value={value.text ?? ''}
          onChange={(e) => onChange({ ...value, text: e.target.value.slice(0, MAX_TEXT) })}
          rows={5}
          maxLength={MAX_TEXT}
          placeholder="اكتب نبذة مختصرة عن الأكاديمية وما تقدمه…"
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className={cn('text-xs', remaining < 50 ? 'text-danger' : 'text-fg-subtle')}>
          {remaining} حرف متبقٍّ
        </p>
      </div>

      {/* Highlights */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">
          نقاط القوة
          <span className="ms-1 text-xs font-normal text-fg-muted">— حتى 3 ميزات بارزة (اختياري)</span>
        </p>
        {HIGHLIGHT_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-subtle-fg">
              {i + 1}
            </span>
            <input
              type="text"
              value={value.highlights?.[i] ?? ''}
              onChange={(e) => setHighlight(i, e.target.value)}
              maxLength={120}
              placeholder={label}
              aria-label={label}
              className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
