'use client';

import React from 'react';
import Link from 'next/link';
import { useAcademy } from '../../../features/public-academy/academy-context';
import { usePublicData } from '../../../features/public-academy/use-public-data';
import { CourseList, SectionTitle, TeacherList } from '../../../features/public-academy/list-sections';
import { publicAcademyApi } from '../../../lib/public-api';
import { buttonClasses } from '../../../components/ui/button-styles';

export default function AcademyHomePage() {
  const academy = useAcademy();
  const courses = usePublicData(() => publicAcademyApi.courses(academy.slug), [academy.slug]);
  const teachers = usePublicData(() => publicAcademyApi.teachers(academy.slug), [academy.slug]);

  const featuredCourses = courses.status === 'ready' ? { status: 'ready' as const, data: courses.data.slice(0, 6) } : courses;
  const featuredTeachers = teachers.status === 'ready' ? { status: 'ready' as const, data: teachers.data.slice(0, 4) } : teachers;

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-brand text-white">
        <span className="pattern-overlay opacity-50 [background-color:rgba(255,255,255,0.1)]" aria-hidden />
        <div className="relative mx-auto max-w-[var(--content-max)] px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="mx-auto max-w-3xl break-words font-display text-4xl leading-tight sm:text-5xl">{academy.name}</h1>
          {academy.brand_tagline && <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">{academy.brand_tagline}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/a/${academy.slug}/courses`} className={buttonClasses('secondary', 'lg')}>
              تصفّح المقررات
            </Link>
            <Link href={`/a/${academy.slug}/teachers`} className="inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10">
              تعرّف على المدرسين
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[var(--content-max)] space-y-16 px-4 py-14 sm:px-6">
        <section>
          <SectionTitle
            title="المقررات"
            subtitle="مقررات الأكاديمية المنشورة."
            action={
              <Link href={`/a/${academy.slug}/courses`} className="text-sm font-semibold text-primary hover:underline">
                عرض الكل
              </Link>
            }
          />
          <CourseList state={featuredCourses} slug={academy.slug} />
        </section>

        <section>
          <SectionTitle
            title="المدرسون"
            subtitle="فريق التدريس في الأكاديمية."
            action={
              <Link href={`/a/${academy.slug}/teachers`} className="text-sm font-semibold text-primary hover:underline">
                عرض الكل
              </Link>
            }
          />
          <TeacherList state={featuredTeachers} slug={academy.slug} />
        </section>
      </div>
    </>
  );
}
