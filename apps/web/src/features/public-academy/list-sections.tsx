'use client';

import React from 'react';
import { BookOpen, Users } from 'lucide-react';
import { CardGrid, CourseCard, GridSkeleton, TeacherCard } from './cards';
import type { LoadState } from './use-public-data';
import type { PublicCourse, PublicTeacher } from '../../lib/public-api';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';

/** Renders loading / error / empty / ready for a public list so each state is explicit. */
function ListState<T>({ state, empty, children }: { state: LoadState<T[]>; empty: React.ReactNode; children: (items: T[]) => React.ReactNode }) {
  if (state.status === 'loading') return <GridSkeleton />;
  if (state.status === 'error') return <ErrorState title="تعذّر تحميل القائمة" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={state.retry} />;
  if (state.status === 'not_found') return <>{empty}</>;
  return state.data.length === 0 ? <>{empty}</> : <>{children(state.data)}</>;
}

export function CourseList({ state, slug }: { state: LoadState<PublicCourse[]>; slug: string }) {
  return (
    <ListState
      state={state}
      empty={<EmptyState icon={<BookOpen size={20} aria-hidden />} title="لا توجد مقررات معروضة بعد" description="ستظهر هنا المقررات المنشورة التي تختار الأكاديمية عرضها للزوار." />}
    >
      {(courses) => (
        <CardGrid>
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} slug={slug} />
          ))}
        </CardGrid>
      )}
    </ListState>
  );
}

export function TeacherList({ state, slug }: { state: LoadState<PublicTeacher[]>; slug: string }) {
  return (
    <ListState
      state={state}
      empty={<EmptyState icon={<Users size={20} aria-hidden />} title="لا يوجد مدرسون معروضون بعد" description="سيظهر هنا المدرسون الذين فعّلوا عرض ملفهم العام." />}
    >
      {(teachers) => (
        <CardGrid className="lg:grid-cols-4">
          {teachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} slug={slug} />
          ))}
        </CardGrid>
      )}
    </ListState>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="heading-accent break-words font-display text-2xl text-fg">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
