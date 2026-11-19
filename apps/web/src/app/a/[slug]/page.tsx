'use client';

import React from 'react';
import Link from 'next/link';
import { useAcademy } from '../../../features/public-academy/academy-context';
import { usePublicData } from '../../../features/public-academy/use-public-data';
import { CourseList, SectionTitle, TeacherList } from '../../../features/public-academy/list-sections';
import { publicAcademyApi } from '../../../lib/public-api';
import { buttonClasses } from '../../../components/ui/button-styles';
import { IconNext } from '../../../components/icons/directional';
import { getTemplateEntry } from '../../../features/tenant-landing/registry';
import { AboutSection, ContactSection, FaqSection } from '../../../features/tenant-landing/sections/content-sections';

/**
 * An academy's public home: who they are, what they offer, and how to join (Quality Gate §11).
 * Everything here is opt-in content; contact details appear only when the owner opts in.
 * The hero comes from the academy's template; the rest is re-styled by templates.css.
 */
export default function AcademyHomePage() {
  const academy = useAcademy();
  const courses = usePublicData(() => publicAcademyApi.courses(academy.slug), [academy.slug]);
  const teachers = usePublicData(() => publicAcademyApi.teachers(academy.slug), [academy.slug]);

  const featuredCourses = courses.status === 'ready' ? { status: 'ready' as const, data: courses.data.slice(0, 6) } : courses;
  const featuredTeachers = teachers.status === 'ready' ? { status: 'ready' as const, data: teachers.data.slice(0, 4) } : teachers;
  const courseCount = courses.status === 'ready' ? courses.data.length : null;
  const teacherCount = teachers.status === 'ready' ? teachers.data.length : null;
  const freeCount = courses.status === 'ready' ? courses.data.filter((c) => c.is_free).length : null;

  // Owner's section toggles (TL-6). Without saved settings: stats, courses and teachers show.
  const sections = academy.landing?.sections ?? {};
  const show = {
    stats: sections.stats ?? true,
    courses: sections.courses ?? true,
    teachers: sections.teachers ?? true,
    about: sections.about ?? false,
    contact: sections.contact ?? false,
    faq: sections.faq ?? false,
  };
  const content = academy.landing?.content;

  const { Hero } = getTemplateEntry(academy.landing?.template ?? 'oasis');

  // Each block is a full-width band so a template can alternate backgrounds (templates.css).
  const band = (key: string, node: React.ReactNode) => (
    <div key={key} className="tl-band">
      <div className="tl-content mx-auto max-w-[var(--content-max)] px-4 py-10 sm:px-6 sm:py-14">{node}</div>
    </div>
  );

  return (
    <>
      <Hero
        academy={academy}
        stats={{ courses: courseCount, teachers: teacherCount, free: freeCount }}
        showStats={show.stats}
      />

      {show.about && content?.about && band('about', <AboutSection name={academy.name} about={content.about} />)}

      {show.courses &&
        band(
          'courses',
          <section>
            <SectionTitle
              title="المقررات"
              subtitle="المقررات المنشورة للعرض العام."
              action={
                <Link href={`/a/${academy.slug}/courses`} className="text-sm font-semibold text-primary hover:underline">
                  عرض الكل
                </Link>
              }
            />
            <CourseList state={featuredCourses} slug={academy.slug} />
          </section>,
        )}

      {show.teachers &&
        band(
          'teachers',
          <section>
            <SectionTitle
              title="المدرسون"
              subtitle="المعلمون الذين فعّلوا ملفهم العام في هذه الأكاديمية."
              action={
                <Link href={`/a/${academy.slug}/teachers`} className="text-sm font-semibold text-primary hover:underline">
                  عرض الكل
                </Link>
              }
            />
            <TeacherList state={featuredTeachers} slug={academy.slug} />
          </section>,
        )}

      {show.faq && (content?.faq?.length ?? 0) > 0 && band('faq', <FaqSection faq={content?.faq} />)}

      {show.contact && content?.contact && band('contact', <ContactSection contact={content.contact} />)}

      {band(
        'cta',
        <section className="tl-panel rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-10">
          <h2 className="font-display text-2xl text-fg">تبحث عن مقعد في {academy.name}؟</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
            {academy.accepts_registrations
              ? 'أرسل طلب تسجيلك وستتواصل معك الأكاديمية لإكمال الإجراءات.'
              : 'هذه الأكاديمية لا تستقبل طلبات تسجيل عبر المنصة حالياً. تواصل معها مباشرة للانضمام.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {academy.accepts_registrations && (
              <Link href={`/register?academy=${encodeURIComponent(academy.slug)}`} className={buttonClasses('primary', 'lg', 'tl-btn')}>
                أرسل طلب تسجيل
                <IconNext size={18} />
              </Link>
            )}
            <Link href="/academies" className={buttonClasses('secondary', 'lg', 'tl-btn')}>
              تصفّح أكاديميات أخرى
            </Link>
          </div>
        </section>,
      )}
    </>
  );
}
