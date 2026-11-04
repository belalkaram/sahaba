import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { publicAcademyApi, type PublicCourse, type PublicTeacher } from '../../lib/public-api';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/cn';

const LEVELS: Record<string, string> = { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' };

/** Remote image with a branded fallback (first letter on the arch pattern) when none is uploaded. */
export function PublicImage({ src, alt, fallback, className }: { src: string | null; alt: string; fallback: string; className?: string }) {
  const url = publicAcademyApi.imageSrc(src);
  if (url) {
    return <img src={url} alt={alt} loading="lazy" className={cn('h-full w-full object-cover', className)} />;
  }
  return (
    <span className={cn('relative grid h-full w-full place-items-center overflow-hidden bg-gradient-brand text-white', className)} aria-hidden>
      <span className="pattern-overlay opacity-60 [background-color:rgba(255,255,255,0.12)]" />
      <span className="relative text-4xl font-bold">{fallback.slice(0, 1)}</span>
    </span>
  );
}

export function CourseCard({ course, slug }: { course: PublicCourse; slug: string }) {
  return (
    <Link
      href={`/a/${slug}/courses/${course.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[16/9] overflow-hidden bg-surface-muted">
        <PublicImage src={course.image_url} alt="" fallback={course.title} className="transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {course.level && <Badge variant="info">{LEVELS[course.level] ?? course.level}</Badge>}
          <Badge variant={course.is_free ? 'success' : 'neutral'}>{course.is_free ? 'مجاني' : 'ضمن باقة'}</Badge>
        </div>
        <h3 className="break-words text-lg font-bold leading-snug text-fg">{course.title}</h3>
        {course.summary && <p className="line-clamp-3 break-words text-sm text-fg-muted">{course.summary}</p>}
        {course.teacher && <p className="mt-auto truncate pt-1 text-sm font-medium text-fg-subtle">{course.teacher.name}</p>}
      </div>
    </Link>
  );
}

export function TeacherCard({ teacher, slug }: { teacher: PublicTeacher; slug: string }) {
  return (
    <Link
      href={`/a/${slug}/teachers/${teacher.id}`}
      className="group flex min-w-0 flex-col items-center gap-3 rounded-xl border border-border bg-surface p-5 text-center shadow-xs transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-border bg-surface-muted">
        <PublicImage src={teacher.image_url} alt="" fallback={teacher.name} />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-lg font-bold text-fg">{teacher.name}</h3>
        {teacher.headline && <p className="line-clamp-2 break-words text-sm text-fg-muted">{teacher.headline}</p>}
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary-subtle-fg">
        <BookOpen size={13} aria-hidden /> {teacher.courses_count} مقرر
      </span>
    </Link>
  );
}

export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="aspect-[16/9] animate-pulse bg-surface-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </CardGrid>
  );
}

