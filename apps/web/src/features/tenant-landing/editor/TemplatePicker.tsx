'use client';

/**
 * TL-5 (ADR-007): Template picker — 5 cards, one per template.
 * Shows template name, audience, and a shape badge matching the manifest.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { getAllManifests } from '../registry';
import { cn } from '../../../lib/cn';
import type { TemplateId } from '../templates/types';

interface Props {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}

const AUDIENCE: Record<TemplateId, string> = {
  oasis:   'الافتراضي لكل أكاديمية جديدة',
  beacon:  'الأكاديميات والمعاهد الكبيرة',
  breeze:  'المدارس والمراحل الأولى والمعلم الخاص',
  atlas:   'المراكز متعددة الفروع والجامعات الأهلية',
  horizon: 'المعلم المستقل الباحث عن البساطة',
};

const STYLE_DESC: Record<TemplateId, string> = {
  oasis:   'قوس إسلامي، بطاقات مرفوعة، حركة ناعمة',
  beacon:  'تحريري جريء، زوايا حادة، حركة حيّة',
  breeze:  'ناعم ومرح، زوايا دائرية، فقاعات عضوية',
  atlas:   'أكاديمي منظّم، شبكة واضحة، أرقام بارزة',
  horizon: 'بياض كثير، خطوط رفيعة، لا حركة',
};

export function TemplatePicker({ value, onChange }: Props) {
  const manifests = getAllManifests();

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">اختر القالب المناسب لشخصية أكاديميتك.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {manifests.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn(
                'relative flex flex-col gap-2 rounded-lg border p-4 text-start transition-all',
                active
                  ? 'border-primary bg-primary-subtle shadow-sm ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-muted',
              )}
              aria-pressed={active}
              aria-label={`اختر قالب ${m.nameAr}`}
            >
              {active && (
                <span className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg">
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                </span>
              )}

              {/* Shape badge */}
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center text-xs font-bold',
                  m.radius === 'full' ? 'rounded-full' : m.radius === 'lg' ? 'rounded-lg' : m.radius === 'sm' ? 'rounded-md' : 'rounded-none',
                  'bg-accent-subtle text-accent',
                )}
                aria-hidden
              >
                {m.nameAr.slice(0, 2)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-fg">{m.nameAr}</p>
                <p className="mt-0.5 truncate text-xs text-fg-muted">{STYLE_DESC[m.id]}</p>
              </div>

              <p className="text-xs text-primary-subtle-fg">
                <span className="font-medium">يناسب: </span>
                {AUDIENCE[m.id]}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
