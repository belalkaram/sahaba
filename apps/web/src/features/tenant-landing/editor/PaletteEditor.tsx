'use client';

/**
 * TL-5 (ADR-007): Palette editor — 4 color pickers with WCAG AA indicator.
 * Uses deriveTenantTheme to show live AA status under each swatch.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useId, useMemo } from 'react';
import { deriveTenantTheme, isValidPalette } from '../../../lib/theme/derive-tenant-theme';
import { PALETTE_PRESETS } from '../api';
import { cn } from '../../../lib/cn';
import type { LandingPalette } from '../api';

interface Props {
  value: LandingPalette;
  onChange: (p: LandingPalette) => void;
}

const LABELS: Record<keyof LandingPalette, string> = {
  primary:   'اللون الأساسي',
  secondary: 'اللون المساند',
  accent:    'لون الإبراز',
  surface:   'نبرة الخلفية',
};

const HINTS: Record<keyof LandingPalette, string> = {
  primary:   'الأزرار، الروابط، الحالة النشطة',
  secondary: 'تدرّج Hero والأقسام',
  accent:    'الشارات والأيقونات الزخرفية',
  surface:   'خلفية الصفحة والبطاقات',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  field, value, onChange, hasWarning,
}: {
  field: keyof LandingPalette;
  value: string;
  onChange: (v: string) => void;
  hasWarning: boolean;
}) {
  const id = useId();
  const isValid = HEX_RE.test(value);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {LABELS[field]}
        <span className="ms-1 text-xs font-normal text-fg-muted">— {HINTS[field]}</span>
      </label>
      <div className="flex items-center gap-2">
        {/* Native colour picker */}
        <input
          type="color"
          value={isValid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label={`منتقي لون ${LABELS[field]}`}
        />
        {/* Hex text input */}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#RRGGBB"
          className={cn(
            'h-9 flex-1 rounded border px-3 font-mono text-sm tabular',
            isValid ? 'border-border bg-surface text-fg' : 'border-danger bg-surface text-danger',
          )}
          aria-invalid={!isValid}
        />
      </div>
      {hasWarning && (
        <p className="text-xs text-fg-muted" role="status">
          <AlertTriangle aria-hidden className="inline h-3.5 w-3.5 align-[-2px]" /> عُدّل تلقائياً للقراءة (AA)
        </p>
      )}
    </div>
  );
}

export function PaletteEditor({ value, onChange }: Props) {
  const { warnings } = useMemo(
    () => (isValidPalette(value) ? deriveTenantTheme(value) : { warnings: [] }),
    [value],
  );

  const fields = Object.keys(LABELS) as Array<keyof LandingPalette>;

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <p className="mb-2 text-sm font-medium text-fg">لوحات جاهزة</p>
        <div className="flex flex-wrap gap-2">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.nameAr}
              type="button"
              onClick={() => onChange(preset.palette)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg hover:border-primary hover:text-primary"
            >
              {/* Colour dots */}
              {(['primary', 'accent'] as const).map((k) => (
                <span
                  key={k}
                  className="h-3 w-3 rounded-full border border-border/60"
                  style={{ background: preset.palette[k] }}
                  aria-hidden
                />
              ))}
              {preset.nameAr}
            </button>
          ))}
        </div>
      </div>

      {/* Four color fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <ColorField
            key={f}
            field={f}
            value={value[f]}
            onChange={(v) => onChange({ ...value, [f]: v })}
            hasWarning={warnings.some((w) => w.includes(f))}
          />
        ))}
      </div>

      {warnings.length > 0 && (
        <p className="rounded border border-border bg-surface-muted px-3 py-2 text-xs text-fg-muted">
          بعض الألوان عُدِّلت آلياً لضمان تباين AA (≥ 4.5:1). يمكنك تغيير الألوان ليتلاءم التباين.
        </p>
      )}
    </div>
  );
}
