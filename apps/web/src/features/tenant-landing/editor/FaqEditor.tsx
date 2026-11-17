'use client';

/**
 * TL-6 (ADR-007): FAQ editor — up to 8 plain-text Q&A pairs.
 * No HTML. Add / remove / reorder pairs.
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { buttonClasses } from '../../../components/ui/button-styles';
import { cn } from '../../../lib/cn';

export interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  value: FaqItem[];
  onChange: (v: FaqItem[]) => void;
}

const MAX_ITEMS = 8;

export function FaqEditor({ value, onChange }: Props) {
  const items = value ?? [];

  const add = () => {
    if (items.length >= MAX_ITEMS) return;
    onChange([...items, { question: '', answer: '' }]);
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const update = (i: number, field: 'question' | 'answer', text: string) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: text } : item);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">أضف أسئلة شائعة يطرحها الزوار — حتى {MAX_ITEMS} أسئلة.</p>

      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-fg-subtle">
          لا توجد أسئلة بعد. اضغط «إضافة سؤال» للبدء.
        </p>
      )}

      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-fg-muted">السؤال {i + 1}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-surface-muted hover:text-danger"
              aria-label={`حذف السؤال ${i + 1}`}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>

          <input
            type="text"
            value={item.question}
            onChange={(e) => update(i, 'question', e.target.value)}
            maxLength={200}
            placeholder="السؤال…"
            aria-label={`نص السؤال ${i + 1}`}
            className="h-9 w-full rounded-md border border-border bg-surface-sunken px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <textarea
            value={item.answer}
            onChange={(e) => update(i, 'answer', e.target.value)}
            maxLength={600}
            rows={3}
            placeholder="الجواب…"
            aria-label={`جواب السؤال ${i + 1}`}
            className="w-full resize-none rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ))}

      {items.length < MAX_ITEMS && (
        <button
          type="button"
          onClick={add}
          className={cn(buttonClasses('secondary', 'sm'), 'w-full justify-center')}
        >
          <Plus size={15} aria-hidden />
          إضافة سؤال
        </button>
      )}

      {items.length >= MAX_ITEMS && (
        <p className="text-center text-xs text-fg-muted">وصلت الحد الأقصى ({MAX_ITEMS} أسئلة).</p>
      )}
    </div>
  );
}
