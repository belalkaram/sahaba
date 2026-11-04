'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useAcademy } from '../../../../../features/public-academy/academy-context';
import { usePublicData } from '../../../../../features/public-academy/use-public-data';
import { CardGrid, CourseCard, PublicImage } from '../../../../../features/public-academy/cards';
import { SectionTitle } from '../../../../../features/public-academy/list-sections';
import { publicAcademyApi } from '../../../../../lib/public-api';
import { IconBack } from '../../../../../components/icons';
import { ErrorState } from '../../../../../components/ui/error-state';
import { buttonClasses } from '../../../../../components/ui/button-styles';

export default function AcademyTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const academy = useAcademy();
  const state = usePublicData(() => publicAcademyApi.teacher(academy.slug, id), [academy.slug, id]);

  if (state.status === 'loading') return <div className="mx-auto h-80 max-w-4xl animate-pulse px-4 py-12" aria-busy="true" />;
  if (state.status === 'error') return <div className="py-16"><ErrorState title="تعذّر تحميل الملف" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={state.retry} /></div>;
  if (state.status === 'not_found') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-fg">الملف غير متاح</h1>
        <p className="text-fg-muted">لم يفعّل هذا المدرس عرض ملفه للزوار.</p>
        <Link href={`/a/${academy.slug}/teachers`} className={buttonClasses('primary', 'md')}>
          كل المدرسين
        </Link>
      </div>
    );
  }

  const t = state.data;
  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-10 sm:px-6">
      <Link href={`/a/${academy.slug}/teachers`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <IconBack size={14} /> كل المدرسين
      </Link>

      <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-surface p-6 text-center sm:flex-row sm:text-start">
        <div className="h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-border bg-surface-muted">
          <PublicImage src={t.image_url} alt={t.name} fallback={t.name} />
        </div>
        <div className="min-w-0 space-y-2">
          <h1 className="break-words font-display text-3xl text-fg">{t.name}</h1>
          {t.headline && <p className="break-words text-lg text-fg-muted">{t.headline}</p>}
          {t.bio && <p className="whitespace-pre-line break-words pt-2 text-fg-muted">{t.bio}</p>}
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle title="مقررات المدرّس" />
        {t.courses && t.courses.length > 0 ? (
          <CardGrid>
            {t.courses.map((c) => (
              <CourseCard key={c.id} course={c} slug={academy.slug} />
            ))}
          </CardGrid>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-fg-muted">لا توجد مقررات معروضة لهذا المدرّس حاليًا.</p>
        )}
      </section>
    </div>
  );
}
