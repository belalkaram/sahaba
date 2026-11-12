'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, GraduationCap, MapPin, Sparkles, Users } from 'lucide-react';
import { publicApi, type DirectoryAcademy, type DirectoryTeacher } from '../../lib/public-api';
import { SectionHeading } from './story-sections';
import { Badge } from '../../components/ui/badge';
import { buttonClasses } from '../../components/ui/button-styles';
import { IconNext } from '../../components/icons/directional';
import { formatNumber } from '../../lib/format';

const KIND_LABELS: Record<string, string> = {
  center: 'مركز',
  academy: 'أكاديمية',
  school: 'مدرسة',
  institute: 'معهد',
};

/** Remote image that falls back to `children` if the file is missing or fails to load. */
export function SafeImage({
  src,
  width,
  height,
  className,
  children,
}: {
  src: string | null;
  width: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{children}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tenant-served image in a fixed box
    <img src={src} alt="" width={width} height={height} loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} />
  );
}

export function academyKind(academy: Pick<DirectoryAcademy, 'type' | 'organization_kind'>): string {
  if (academy.type === 'individual_teacher') return 'مدرس مستقل';
  return KIND_LABELS[academy.organization_kind ?? ''] ?? 'أكاديمية';
}

/** Academy card used on the landing rail and in the full directory. */
export function AcademyCard({ academy }: { academy: DirectoryAcademy }) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-muted">
          <SafeImage src={academy.logo_url} width={56} height={56} className="h-full w-full object-contain p-1.5">
            <Building2 size={22} className="text-fg-subtle" aria-hidden />
          </SafeImage>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-fg transition-colors group-hover:text-primary">{academy.name}</h3>
            {academy.is_featured && (
              <Badge variant="accent" size="sm" icon={<Sparkles size={11} aria-hidden />}>
                مميّزة
              </Badge>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            <span>{academyKind(academy)}</span>
            {academy.city && (
              <>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} aria-hidden />
                  {academy.city}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {academy.tagline && <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-fg-muted">{academy.tagline}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-4">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
          {academy.courses_count !== null && (
            <span className="inline-flex items-center gap-1">
              <GraduationCap size={13} aria-hidden /> {formatNumber(academy.courses_count)} مقرر
            </span>
          )}
          {academy.teachers_count !== null && (
            <span className="inline-flex items-center gap-1">
              <Users size={13} aria-hidden /> {formatNumber(academy.teachers_count)} معلم
            </span>
          )}
          {academy.services.includes('offline') && <span>حضوري</span>}
          {academy.services.includes('online') && <span>أونلاين</span>}
        </span>
        <Link href={academy.academy_url} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
          زيارة الصفحة
          <IconNext size={13} />
        </Link>
      </div>
    </article>
  );
}

/** Teacher card used on the landing rail and in the full directory. */
export function TeacherCard({ teacher }: { teacher: DirectoryTeacher }) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
      <div className="mb-4 flex items-center gap-3">
        <span className="arch h-16 w-14 shrink-0 overflow-hidden bg-primary-subtle">
          <SafeImage src={teacher.photo_url} width={56} height={64} className="h-full w-full object-cover">
            <span className="grid h-full w-full place-items-center text-lg font-bold text-primary">{teacher.name.slice(0, 1)}</span>
          </SafeImage>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-fg transition-colors group-hover:text-primary">{teacher.name}</h3>
            {teacher.is_featured && <Sparkles size={13} className="shrink-0 text-accent" aria-label="معلم مميّز" />}
          </div>
          <p className="line-clamp-1 text-xs text-fg-muted">{teacher.headline || 'معلم معتمد'}</p>
        </div>
      </div>

      {teacher.bio && <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-fg-muted">{teacher.bio}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-4 text-xs">
        <Link href={teacher.academy_url} className="inline-flex min-w-0 items-center gap-1 text-fg-subtle hover:text-fg">
          <GraduationCap size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{teacher.tenant_name}</span>
        </Link>
        <Link href={teacher.profile_url} className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline">
          صفحة المعلم
          <IconNext size={13} />
        </Link>
      </div>
    </article>
  );
}

/**
 * Horizontal rail: scroll-snap and a drag handler (landing-motion.tsx) on touch and pointer, a
 * plain grid from `lg` up. Keyboard users tab through the cards, which scrolls them into view.
 */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-rail
      className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:pb-0"
    >
      {React.Children.map(children, (child) => (
        <div className="w-[85vw] max-w-sm shrink-0 snap-start sm:w-[22rem] lg:w-auto lg:max-w-none" data-reveal>
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * `initial` is what the server fetched: a list, or null when it could not reach the API. Only in
 * the null case does the browser ask again, so a slow API at build time does not hide the section.
 */
function useShowcase<T>(initial: T[] | null, load: () => Promise<T[]>): T[] {
  const [items, setItems] = useState<T[]>(initial ?? []);
  useEffect(() => {
    if (initial !== null) return;
    let cancelled = false;
    load()
      .then((data) => !cancelled && setItems(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  return items;
}

export function AcademiesSection({ initial }: { initial: DirectoryAcademy[] | null }) {
  const academies = useShowcase(initial, () => publicApi.getDirectoryAcademies({ per_page: 6 }).then((r) => r.academies));
  if (academies.length === 0) return null;

  return (
    <section id="academies" className="scroll-mt-24 py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="على سحابة"
            title="أكاديميات ومراكز تعلّم بها الآن"
            description="تصفّح صفحة كل أكاديمية: مقرراتها ومعلموها وطريقة التسجيل بها."
            align="start"
          />
          <Link href="/academies" className={buttonClasses('secondary', 'md', 'mb-12 shrink-0')} data-reveal>
            كل الأكاديميات
            <IconNext size={16} />
          </Link>
        </div>
        <Rail>
          {academies.map((academy) => (
            <AcademyCard key={academy.slug} academy={academy} />
          ))}
        </Rail>
      </div>
    </section>
  );
}

export function TeachersSection({ initial }: { initial: DirectoryTeacher[] | null }) {
  const teachers = useShowcase(initial, () => publicApi.getDirectoryTeachers({ per_page: 6 }));
  if (teachers.length === 0) return null;

  return (
    <section id="teachers" className="scroll-mt-24 bg-surface py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="نخبة المعلمين"
            title="معلمون اختاروا أن تظهر ملفاتهم"
            description="كل معلم هنا فعّل ملفه العام بنفسه، وصفحته تعرض مقرراته المنشورة."
            align="start"
          />
          <Link href="/teachers" className={buttonClasses('secondary', 'md', 'mb-12 shrink-0')} data-reveal>
            كل المعلمين
            <IconNext size={16} />
          </Link>
        </div>
        <Rail>
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </Rail>
      </div>
    </section>
  );
}
