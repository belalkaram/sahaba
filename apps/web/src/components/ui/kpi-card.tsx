'use client';

import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useCountUp } from '../../lib/motion/hooks';
import { formatNumber, formatPercent, toArabicDigits } from '../../lib/format';

export type KpiTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

const toneTile: Record<KpiTone, string> = {
  brand: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  accent: 'bg-accent-subtle text-accent',
  neutral: 'bg-surface-muted text-fg-muted',
};

export interface KpiCardProps {
  label: string;
  /** Numbers count up and render with Arabic digits; strings render as given. */
  value: string | number | null | undefined;
  /** Render a numeric value as a percentage («٨٥٪»). */
  unit?: 'number' | 'percent';
  delta?: {
    value: string;
    isPositive?: boolean;
    neutral?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  tone?: KpiTone;
  /** Shown under the value; use it to give zero/empty values context. */
  hint?: React.ReactNode;
  sparkline?: React.ReactNode;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit = 'number',
  delta,
  icon,
  tone = 'brand',
  hint,
  sparkline,
  className = '',
}) => {
  // Legacy callers pass pre-formatted strings ("98.50%", "12"): normalize them so every KPI
  // counts up and renders with Arabic-Indic digits (OD-17).
  let numeric = typeof value === 'number' ? value : null;
  let resolvedUnit = unit;
  let text = typeof value === 'string' ? value : null;
  if (text !== null) {
    const pct = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    const num = text.trim().match(/^-?\d+(?:\.\d+)?$/);
    if (pct) {
      numeric = Number(pct[1]);
      resolvedUnit = 'percent';
      text = null;
    } else if (num) {
      numeric = Number(num[0]);
      text = null;
    } else {
      text = toArabicDigits(text);
    }
  }
  const fmt = resolvedUnit === 'percent' ? (n: number) => formatPercent(n, 1) : (n: number) => formatNumber(n, 1);
  const countRef = useCountUp(numeric, fmt);

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-fg-muted">{label}</span>
        {icon && <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', toneTile[tone])}>{icon}</span>}
      </div>

      <div className="mt-2 text-3xl font-bold leading-tight text-fg tabular">
        {numeric !== null ? <span ref={countRef}>{fmt(numeric)}</span> : <span>{text ?? '—'}</span>}
      </div>

      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}

      {(delta || sparkline) && (
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
          {delta && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
                  delta.neutral
                    ? 'bg-surface-muted text-fg-muted'
                    : delta.isPositive
                      ? 'bg-success-subtle text-success-subtle-fg'
                      : 'bg-danger-subtle text-danger-subtle-fg',
                )}
              >
                {!delta.neutral &&
                  (delta.isPositive ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />)}
                {delta.value}
              </span>
              {delta.label && <span className="text-fg-subtle">{delta.label}</span>}
            </div>
          )}
          {sparkline && <div className="shrink-0">{sparkline}</div>}
        </div>
      )}
    </div>
  );
};
