'use client';

import React, { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import type { AnnouncementAudience, AnnouncementOptions, AnnouncementTarget, AudiencePreview } from '../../lib/announcement-api';
import { announcementApi } from '../../lib/announcement-api';
import { educationApi } from '../../lib/education-api';
import { Switch } from '../../components/ui/switch';
import { SearchInput } from '../../components/ui/search-input';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';
import { TARGET_COPY } from './labels';

interface Props {
  options: AnnouncementOptions;
  value: AnnouncementAudience;
  onChange: (value: AnnouncementAudience) => void;
  /** Names for chosen students (ids alone are not readable). */
  studentNames: Record<string, string>;
  onStudentNames: (names: Record<string, string>) => void;
  error?: string;
}

/** Exactly who receives the announcement: which students, and whether the students and/or their parents. */
export function AudiencePicker({ options, value, onChange, studentNames, onStudentNames, error }: Props) {
  const choices: { id: string; label: string }[] =
    value.target === 'courses'
      ? options.courses.map((c) => ({ id: c.id, label: c.title }))
      : value.target === 'classes'
        ? options.classes.map((c) => ({ id: c.id, label: c.name }))
        : value.target === 'grades'
          ? options.grades.map((g) => ({ id: g, label: g }))
          : [];

  const toggle = (id: string) =>
    onChange({ ...value, ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">مَن من الطلاب؟</legend>
        <div className="flex flex-wrap gap-2">
          {options.targets.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...value, target: t as AnnouncementTarget, ids: [] })}
              aria-pressed={value.target === t}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                value.target === t ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              {TARGET_COPY[t]}
            </button>
          ))}
        </div>
      </fieldset>

      {choices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">اختر واحداً أو أكثر</span>
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onChange({ ...value, ids: value.ids.length === choices.length ? [] : choices.map((c) => c.id) })}>
              {value.ids.length === choices.length ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          </div>
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-border bg-surface-sunken p-3">
            {choices.map((c) => {
              const on = value.ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  className={cn('rounded-md border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary-subtle font-semibold text-primary-subtle-fg' : 'border-border bg-surface hover:bg-surface-muted')}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {value.target !== 'all' && value.target !== 'students' && choices.length === 0 && (
        <p className="rounded-md bg-surface-sunken p-3 text-sm text-fg-muted">لا توجد عناصر متاحة لهذا الاختيار.</p>
      )}

      {value.target === 'students' && (
        <StudentPicker
          selected={value.ids}
          names={studentNames}
          onChange={(ids, names) => {
            onStudentNames({ ...studentNames, ...names });
            onChange({ ...value, ids });
          }}
        />
      )}

      <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
        <Switch checked={value.students} onChange={(v) => onChange({ ...value, students: v })} label="الطلاب أنفسهم" />
        <Switch checked={value.parents} onChange={(v) => onChange({ ...value, parents: v })} label="أولياء أمورهم" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function StudentPicker({ selected, names, onChange }: { selected: string[]; names: Record<string, string>; onChange: (ids: string[], names: Record<string, string>) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    educationApi
      .getStudentsPage({ page: 1, perPage: 20, search: search || undefined })
      .then((res) => {
        if (!cancelled) setResults(res.items.map((s) => ({ id: s.id, name: s.user?.name ?? s.student_code ?? s.id, code: s.student_code })));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-sm font-medium text-primary-subtle-fg">
              {names[id] ?? id}
              <button type="button" onClick={() => onChange(selected.filter((x) => x !== id), {})} aria-label={`إزالة ${names[id] ?? ''}`}>
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم الطالب أو كوده أو جواله" />
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-busy={loading}>
        {results.length === 0 && <li className="p-3 text-sm text-fg-muted">{loading ? 'جارٍ البحث…' : 'لا نتائج.'}</li>}
        {results.map((s) => {
          const on = selected.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChange(on ? selected.filter((x) => x !== s.id) : [...selected, s.id], { [s.id]: s.name })}
                aria-pressed={on}
                className={cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-surface-muted', on && 'bg-primary-subtle')}
              >
                <span className="font-medium text-fg">{s.name}</span>
                <span className="ltr-isolate text-xs text-fg-muted">{s.code}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Live count of who exactly will receive it. */
export function AudienceCount({ audience }: { audience: AnnouncementAudience }) {
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const ready = audience.target === 'all' || audience.ids.length > 0;
  const key = JSON.stringify(audience);

  useEffect(() => {
    if (!ready || (!audience.students && !audience.parents)) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setState('loading');
    const t = window.setTimeout(() => {
      announcementApi
        .preview(audience)
        .then((p) => {
          if (!cancelled) {
            setPreview(p);
            setState('idle');
          }
        })
        .catch(() => !cancelled && setState('error'));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the audience
  }, [key, ready]);

  return (
    <div className="rounded-md border border-border bg-surface-sunken p-3 text-sm" aria-live="polite">
      <p className="flex items-center gap-2 font-semibold text-fg">
        <Users size={16} aria-hidden />
        {!ready
          ? 'اختر الفئة لمعرفة عدد المستلمين'
          : state === 'loading'
            ? 'جارٍ حساب المستلمين…'
            : state === 'error'
              ? 'تعذّر حساب المستلمين'
              : preview
                ? `سيصل إلى ${formatNumber(preview.recipients)} شخصاً (${formatNumber(preview.students)} طالباً، ${formatNumber(preview.parents)} ولي أمر)`
                : '—'}
      </p>
      {preview && preview.sample.length > 0 && (
        <p className="mt-1 text-fg-muted">
          منهم: {preview.sample.map((p) => p.name).join('، ')}
          {preview.recipients > preview.sample.length ? '…' : ''}
        </p>
      )}
    </div>
  );
}
