'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { ListChecks, PlayCircle } from 'lucide-react';
import { useAcademy } from '../../../../../features/public-academy/academy-context';
import { usePublicData } from '../../../../../features/public-academy/use-public-data';
import { PublicImage } from '../../../../../features/public-academy/cards';
import { publicAcademyApi } from '../../../../../lib/public-api';
import { Badge } from '../../../../../components/ui/badge';
import { IconBack } from '../../../../../components/icons';
import { ErrorState } from '../../../../../components/ui/error-state';
import { buttonClasses } from '../../../../../components/ui/button-styles';

const LEVELS: Record<string, string> = { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' };

export default function AcademyCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const academy = useAcademy();
  const state = usePublicData(() => publicAcademyApi.course(academy.slug, id), [academy.slug, id]);

  if (state.status === 'loading') return <div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-12" aria-busy="true" />;
  if (state.status === 'error') return <div className="py-16"><ErrorState title="تعذّر تحميل المقرر" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={state.retry} /></div>;
  if (state.status === 'not_found') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-fg">المقرر غير متاح</h1>
        <p className="text-fg-muted">قد يكون المقرر غير منشور أو غير معروض للزوار.</p>
        <Link href={`/a/${academy.slug}/courses`} className={buttonClasses('primary', 'md')}>
          كل المقررات
        </Link>
      </div>
    );
  }

  const c = state.data;
  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-10 sm:px-6">
      <Link href={`/a/${academy.slug}/courses`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <IconBack size={14} /> كل المقررات
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border bg-surface-muted">
            <PublicImage src={c.image_url} alt={c.title} fallback={c.title} />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {c.level && <Badge variant="info">{LEVELS[c.level] ?? c.level}</Badge>}
              <Badge variant={c.is_free ? 'success' : 'neutral'}>{c.is_free ? 'مجاني' : 'ضمن باقة'}</Badge>
            </div>
            <h1 className="break-words font-display text-3xl text-fg">{c.title}</h1>
            {c.description && <p className="whitespace-pre-line break-words text-fg-muted">{c.description}</p>}
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3 text-fg-muted">
              <PlayCircle size={18} aria-hidden />
              <span>{c.lesson_count ?? 0} درس</span>
            </div>
            {c.teacher && (
              <Link href={`/a/${academy.slug}/teachers/${c.teacher.id}`} className="block text-sm">
                <span className="text-fg-subtle">المدرّس: </span>
                <span className="font-semibold text-primary hover:underline">{c.teacher.name}</span>
              </Link>
            )}
            <Link href={`/login?tenant=${encodeURIComponent(academy.slug)}`} className={buttonClasses('primary', 'lg', 'w-full')}>
              سجّل الدخول للالتحاق
            </Link>
          </div>

          {c.modules && c.modules.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-fg">
                <ListChecks size={18} aria-hidden /> محتوى المقرر
              </h2>
              <ol className="space-y-2">
                {c.modules.map((m, i) => (
                  <li key={i} className="break-words rounded-md bg-surface-muted px-3 py-2 text-sm text-fg">
                    {m.title}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
