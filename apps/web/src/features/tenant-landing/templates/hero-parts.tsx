'use client';

/**
 * Shared pieces for the template heroes (ADR-007): the data every hero shows and small parts
 * (meta chips, join links, stats) so each template only decides layout and look.
 */
import React from 'react';
import Link from 'next/link';
import { Building2, MapPin, MonitorPlay } from 'lucide-react';
import type { AcademyProfile } from '../../../lib/public-api';
import { academyKind } from '../../landing/showcase';
import { formatNumber } from '../../../lib/format';
import { cn } from '../../../lib/cn';

export interface HeroStats {
  courses: number | null;
  teachers: number | null;
  free: number | null;
}

export interface HeroProps {
  academy: AcademyProfile;
  stats: HeroStats;
  /** Owner's "stats" section toggle. */
  showStats: boolean;
}

export function heroLinks(academy: AcademyProfile) {
  return {
    courses: `/a/${academy.slug}/courses`,
    join: academy.accepts_registrations
      ? { href: `/register?academy=${encodeURIComponent(academy.slug)}`, label: 'سجّل في هذه الأكاديمية' }
      : { href: `/login?tenant=${encodeURIComponent(academy.slug)}`, label: 'لدي حساب — تسجيل الدخول' },
  };
}

/** Kind · city · online/offline, as chips or plain inline text. */
export function HeroMeta({ academy, className, chipClassName }: { academy: AcademyProfile; className?: string; chipClassName?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', className)}>
      <span className={cn('inline-flex items-center gap-1.5', chipClassName)}>
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
  );
}

/** The stat entries to show; free courses only when there are some. */
export function statItems(stats: HeroStats): Array<{ label: string; value: number | null }> {
  const items = [
    { label: 'مقرر منشور', value: stats.courses },
    { label: 'معلم', value: stats.teachers },
  ];
  if (stats.free !== null && stats.free > 0) items.push({ label: 'مقرر مجاني', value: stats.free });
  return items;
}

export function statValue(v: number | null): string {
  return v === null ? '—' : formatNumber(v);
}

export function HeroLogo({ academy, className }: { academy: AcademyProfile; className?: string }) {
  if (!academy.logo_url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- tenant logo served by the API, fixed box
  return <img src={academy.logo_url} alt="" width={88} height={88} className={cn('object-contain', className)} />;
}

export function JoinNote({ academy, className }: { academy: AcademyProfile; className?: string }) {
  if (!academy.accepts_registrations) return null;
  return <p className={cn('text-xs', className)}>التسجيل يُراجع من الأكاديمية قبل تفعيل الحساب.</p>;
}

export { Link };
