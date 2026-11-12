'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Building2, MapPin, MonitorPlay, Users } from 'lucide-react';
import { useAcademy } from '../../../features/public-academy/academy-context';
import { usePublicData } from '../../../features/public-academy/use-public-data';
import { CourseList, SectionTitle, TeacherList } from '../../../features/public-academy/list-sections';
import { academyKind } from '../../../features/landing/showcase';
import { publicAcademyApi } from '../../../lib/public-api';
import { buttonClasses } from '../../../components/ui/button-styles';
import { IconNext } from '../../../components/icons/directional';
import { formatNumber } from '../../../lib/format';

/**
 * An academy's public home: who they are, what they offer, and how to join (Quality Gate §11).
 * Everything here is opt-in content; contact details are never published.
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

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-brand text-white">
        <span className="pattern-overlay opacity-50 [background-color:rgba(255,255,255,0.1)]" aria-hidden />
        <div className="relative mx-auto max-w-[var(--content-max)] px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-col items-center gap-6 text-center">
            {academy.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element -- tenant logo served by the API, fixed box
              <img
                src={academy.logo_url}
                alt=""
                width={88}
                height={88}
                className="h-22 w-22 rounded-2xl border border-white/30 bg-white/95 object-contain p-2 shadow-lg"
              />
            )}
            <div className="space-y-3">
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  <Building2 size={13} aria-hidden />
                  {academyKind(academy)}
                </span>
                {academy.city && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} aria-hidden />
                    {academy.city}
                  </span>
                )}
                {academy.services.includes('online') && (
                  <span className="inline-flex items-center gap-1.5">
                    <MonitorPlay size={13} aria-hidden />
                    أونلاين
                  </span>
                )}
                {academy.services.includes('offline') && <span>حضوري</span>}
              </p>
              <h1 className="mx-auto max-w-3xl break-words font-display text-4xl leading-tight sm:text-5xl">{academy.name}</h1>
              {academy.brand_tagline && <p className="mx-auto max-w-2xl text-lg text-white/80">{academy.brand_tagline}</p>}
            </div>

            <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-white/20 py-4">
              <Stat label="مقرر منشور" value={courseCount} icon={<BookOpen size={14} aria-hidden />} />
              <Stat label="معلم" value={teacherCount} icon={<Users size={14} aria-hidden />} />
              {freeCount !== null && freeCount > 0 && <Stat label="مقرر مجاني" value={freeCount} />}
            </dl>

            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`/a/${academy.slug}/courses`} className={buttonClasses('secondary', 'lg', 'border-transparent bg-white text-[var(--emerald-800)] hover:bg-white/90')}>
                تصفّح المقررات
                <IconNext size={18} />
              </Link>
              {academy.accepts_registrations ? (
                <Link href={`/register?academy=${encodeURIComponent(academy.slug)}`} className="inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-6 font-semibold text-white transition-colors hover:bg-white/10">
                  سجّل في هذه الأكاديمية
                </Link>
              ) : (
                <Link href={`/login?tenant=${encodeURIComponent(academy.slug)}`} className="inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-6 font-semibold text-white transition-colors hover:bg-white/10">
                  لدي حساب — تسجيل الدخول
                </Link>
              )}
            </div>
            {academy.accepts_registrations && (
              <p className="text-xs text-white/70">التسجيل يُراجع من الأكاديمية قبل تفعيل الحساب.</p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[var(--content-max)] space-y-16 px-4 py-14 sm:px-6">
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
        </section>

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
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-10">
          <h2 className="font-display text-2xl text-fg">تبحث عن مقعد في {academy.name}؟</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
            {academy.accepts_registrations
              ? 'أرسل طلب تسجيلك وستتواصل معك الأكاديمية لإكمال الإجراءات.'
              : 'هذه الأكاديمية لا تستقبل طلبات تسجيل عبر المنصة حالياً. تواصل معها مباشرة للانضمام.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {academy.accepts_registrations && (
              <Link href={`/register?academy=${encodeURIComponent(academy.slug)}`} className={buttonClasses('primary', 'lg')}>
                أرسل طلب تسجيل
                <IconNext size={18} />
              </Link>
            )}
            <Link href="/academies" className={buttonClasses('secondary', 'lg')}>
              تصفّح أكاديميات أخرى
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | null; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <dt className="flex items-center justify-center gap-1.5 text-xs text-white/70">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl tabular">{value === null ? '—' : formatNumber(value)}</dd>
    </div>
  );
}
