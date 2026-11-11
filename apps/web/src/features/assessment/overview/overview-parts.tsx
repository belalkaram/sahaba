'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCan } from '../../../hooks/useCan';
import { cn } from '../../../lib/cn';
import { formatNumber } from '../../../lib/format';

/** Exams, assignments and grading are one workflow: this strip moves between them. */
export function AssessmentTabs() {
  const pathname = usePathname();
  const canViewExams = useCan('exams.view');
  const canViewAssignments = useCan('assignments.view');
  const canGradeExams = useCan('exams.grade');

  const tabs = [
    canViewExams && { href: '/teacher/exams', label: 'الاختبارات' },
    canViewAssignments && { href: '/teacher/assignments', label: 'الواجبات' },
    canGradeExams && { href: '/teacher/grading', label: 'التصحيح' },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <nav aria-label="أقسام التقييم" className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 w-fit max-w-full overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? 'page' : undefined}
          className={cn(
            'rounded-sm px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
            pathname === tab.href ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg hover:bg-surface-muted',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/** One labelled number on a row. Tinted only when it asks for attention, so quiet rows stay quiet. */
export function StatCell({ label, value, tone = 'neutral', hint }: { label: string; value: number | string | null; tone?: StatTone; hint?: string }) {
  const text = typeof value === 'number' ? formatNumber(value, 2) : (value ?? '—');
  return (
    <div className="rounded-sm bg-surface-muted px-3 py-2 min-w-0" title={hint}>
      <dt className="text-xs text-fg-muted truncate">{label}</dt>
      <dd className={cn('mt-0.5 text-base font-bold tabular', TONE[tone])}>{text}</dd>
    </div>
  );
}

export interface FunnelSegment {
  label: string;
  value: number;
  className: string;
}

/** Share of the enrolled students in each state. Shows the plain fact when nobody is enrolled. */
export function ParticipationBar({ total, segments }: { total: number; segments: FunnelSegment[] }) {
  if (total === 0) {
    return <p className="text-xs text-fg-muted">لا يوجد طلاب مسجلون في هذا المقرر.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${formatNumber(s.value)}`).join('، ')}
      >
        {segments.map((s) =>
          s.value > 0 ? <span key={s.label} className={s.className} style={{ width: `${Math.min(100, (s.value / total) * 100)}%` }} /> : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('h-2 w-2 rounded-full', s.className)} />
            {s.label} {formatNumber((s.value / total) * 100, 0)}٪
          </li>
        ))}
      </ul>
    </div>
  );
}

/** KPI that also works as a shortcut to its filter. */
export function KpiFilterButton({ label, value, tone = 'neutral', active, onClick }: { label: string; value: number | string | null; tone?: StatTone; active?: boolean; onClick?: () => void }) {
  const text = typeof value === 'number' ? formatNumber(value, 1) : (value ?? '—');
  const content = (
    <>
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className={cn('mt-1 block text-2xl font-bold tabular', TONE[tone])}>{text}</span>
    </>
  );
  const base = 'rounded-md border bg-surface p-4 text-start shadow-xs';

  if (!onClick) return <div className={cn(base, 'border-border')}>{content}</div>;

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(base, 'transition-colors hover:border-primary/50', active ? 'border-primary' : 'border-border')}>
      {content}
    </button>
  );
}
