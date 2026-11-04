'use client';

import React, { useMemo, useState } from 'react';
import { useAcademy } from '../../../../features/public-academy/academy-context';
import { usePublicData } from '../../../../features/public-academy/use-public-data';
import { CourseList, SectionTitle } from '../../../../features/public-academy/list-sections';
import { publicAcademyApi } from '../../../../lib/public-api';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/cn';

const LEVELS = [
  { value: 'all', label: 'الكل' },
  { value: 'beginner', label: 'مبتدئ' },
  { value: 'intermediate', label: 'متوسط' },
  { value: 'advanced', label: 'متقدم' },
];

export default function AcademyCoursesPage() {
  const academy = useAcademy();
  const state = usePublicData(() => publicAcademyApi.courses(academy.slug), [academy.slug]);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return state;
    const q = query.trim().toLowerCase();
    return {
      status: 'ready' as const,
      data: state.data.filter((c) => (level === 'all' || c.level === level) && (!q || c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q))),
    };
  }, [state, query, level]);

  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-12 sm:px-6">
      <SectionTitle title="المقررات" subtitle="اختر المقرر المناسب وتعرّف على محتواه ومدرّسه." />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المقرر…" aria-label="بحث في المقررات" className="sm:max-w-sm" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية حسب المستوى">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLevel(l.value)}
              aria-pressed={level === l.value}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                level === l.value ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-border bg-surface text-fg-muted hover:bg-surface-muted',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <CourseList state={filtered} slug={academy.slug} />
    </div>
  );
}
