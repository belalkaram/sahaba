'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Check, GraduationCap, Search } from 'lucide-react';
import { registrationApi, type RegistrationAcademy } from '../../lib/public-api';
import { Input } from '../../components/ui/input';
import { ErrorState } from '../../components/ui/error-state';
import { EmptyState } from '../../components/ui/empty-state';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const KIND: Record<string, string> = { center: 'سنتر', academy: 'أكاديمية', school: 'مدرسة', institute: 'معهد' };

/** Pick one or more centers / independent teachers. Each one reviews the request on its own. */
export function AcademiesStep({ selected, max, error, onChange }: { selected: string[]; max: number; error?: string; onChange: (slugs: string[], names: Record<string, string>) => void }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; items: RegistrationAcademy[] }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Keeps selections visible even when a later search no longer lists them.
  const [known, setKnown] = useState<Record<string, RegistrationAcademy>>({});

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      registrationApi
        .academies(query.trim() || undefined)
        .then((items) => {
          if (cancelled) return;
          setState({ status: 'ready', items });
          setKnown((prev) => ({ ...prev, ...Object.fromEntries(items.map((a) => [a.slug, a])) }));
        })
        .catch(() => !cancelled && setState({ status: 'error' }));
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, attempt]);

  const toggle = (slug: string) => {
    const names = Object.fromEntries(Object.values(known).map((a) => [a.slug, a.name]));
    if (selected.includes(slug)) onChange(selected.filter((s) => s !== slug), names);
    else if (selected.length < max) onChange([...selected, slug], names);
  };

  return (
    <div className="space-y-4">
      <Input label="ابحث عن مؤسسة أو مدرس" iconPrefix={<Search size={16} aria-hidden />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="الاسم أو المدينة" />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="الجهات المختارة">
          {selected.map((slug) => (
            <button key={slug} type="button" onClick={() => toggle(slug)} className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-sm font-medium text-primary-subtle-fg hover:bg-primary/15">
              {known[slug]?.name ?? slug} <span aria-hidden>×</span>
              <span className="sr-only">إزالة</span>
            </button>
          ))}
          <span className="self-center text-xs text-fg-muted">
            {formatNumber(selected.length)} من {formatNumber(max)}
          </span>
        </div>
      )}

      {state.status === 'loading' && <div className="h-40 animate-pulse rounded-lg bg-surface-muted" aria-busy="true" />}
      {state.status === 'error' && <ErrorState title="تعذّر تحميل القائمة" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === 'ready' && state.items.length === 0 && (
        <EmptyState icon={<Building2 size={20} aria-hidden />} title="لا توجد نتائج" description="لا توجد مؤسسات أو مدرسون يستقبلون طلبات التسجيل حاليًا بهذا البحث." />
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" role="listbox" aria-multiselectable="true" aria-label="المؤسسات والمدرسون">
          {state.items.map((a) => {
            const on = selected.includes(a.slug);
            const full = !on && selected.length >= max;
            const Icon = a.type === 'individual_teacher' ? GraduationCap : Building2;
            return (
              <li key={a.slug} role="option" aria-selected={on}>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => toggle(a.slug)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors disabled:opacity-50',
                    on ? 'border-primary bg-primary-subtle' : 'border-border bg-surface hover:bg-surface-muted',
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-muted text-primary">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-bold text-fg">{a.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {a.type === 'individual_teacher' ? 'مدرس مستقل' : KIND[a.organization_kind ?? ''] ?? 'مؤسسة تعليمية'}
                      {a.city ? ` · ${a.city}` : ''}
                    </span>
                    {a.tagline && <span className="mt-1 line-clamp-2 block break-words text-xs text-fg-subtle">{a.tagline}</span>}
                  </span>
                  {on && <Check size={18} className="mt-1 shrink-0 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
