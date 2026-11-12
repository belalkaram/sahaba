'use client';

import React from 'react';
import { Building2, GraduationCap, Library, MapPin, type LucideIcon } from 'lucide-react';
import type { DirectoryAcademy, PublicStats } from '../../lib/public-api';
import { LOGOS } from './content';
import { SafeImage } from './showcase';
import { SampleTag } from './sample-tag';
import { useCountUp } from '../../lib/motion/hooks';
import { formatNumber } from '../../lib/format';

/** Generated marks for the fictional academies kept until real ones opt in (OD-21). */
function LogoMark({ shape }: { shape: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      {shape === 'cloud' && <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" {...common} />}
      {shape === 'star' && <path d="M12 3l2.6 5.6L20 12l-5.4 3.4L12 21l-2.6-5.6L4 12l5.4-3.4z" {...common} />}
      {shape === 'dome' && <path d="M4 20h16M6 20v-6a6 6 0 0 1 12 0v6M12 4v4" {...common} />}
      {shape === 'wave' && <path d="M3 14c3-4 6 4 9 0s6 4 9 0M3 19c3-4 6 4 9 0s6 4 9 0" {...common} />}
      {shape === 'tower' && <path d="M9 21V9l3-5 3 5v12M7 21h10M10 13h4" {...common} />}
    </svg>
  );
}

function StatValue({ value }: { value: number }) {
  const ref = useCountUp(value, (n) => formatNumber(Math.round(n)));
  return (
    <span ref={ref} className="tabular">
      {formatNumber(value)}
    </span>
  );
}

interface Stat {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
}

/**
 * Trust strip: the platform's real numbers and the academies that opted in. Until any academy is
 * listed, the illustrative numbers and generated marks from content.ts are shown, labelled as
 * sample content (OD-21) — nothing here claims a number the system cannot prove.
 */
export function TrustStrip({ stats, academies }: { stats: PublicStats | null; academies: DirectoryAcademy[] }) {
  const real: Stat[] = stats
    ? [
        { key: 'academies', label: 'مركز وأكاديمية', value: stats.academies_count, icon: Building2 },
        { key: 'teachers', label: 'معلم ومعلمة', value: stats.teachers_count, icon: GraduationCap },
        { key: 'courses', label: 'مقرر منشور', value: stats.courses_count ?? 0, icon: Library },
        { key: 'cities', label: 'مدينة', value: stats.cities_count, icon: MapPin },
      ].filter((s) => s.value > 0)
    : [];

  // Fewer than two real numbers is not a trust strip yet; fall back to the labelled sample.
  const useReal = real.length >= 2;

  return (
    <section className="border-y border-border bg-surface py-10" data-reveal-group>
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col items-center gap-8 px-4 sm:px-6">
        <dl className="grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-6 text-center sm:grid-cols-4" data-reveal>
          {useReal
            ? real.map(({ key, label, value, icon: Icon }) => (
                <div key={key}>
                  <dt className="flex items-center justify-center gap-1.5 text-xs text-fg-muted">
                    <Icon size={14} aria-hidden /> {label}
                  </dt>
                  <dd className="mt-1.5 font-display text-2xl text-fg sm:text-3xl">
                    <StatValue value={value} />
                  </dd>
                </div>
              ))
            : LANDING_SAMPLE_STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-fg-muted">{s.label}</dt>
                  <dd className="mt-1.5 font-display text-2xl text-fg sm:text-3xl">{s.value}</dd>
                </div>
              ))}
        </dl>

        <div className="flex w-full flex-col items-center gap-4 border-t border-border-subtle pt-7" data-reveal>
          <p className="text-sm text-fg-muted">
            {academies.length > 0 ? 'أكاديميات ومراكز تعمل على سحابة' : 'تثق بنا مراكز وأكاديميات في أنحاء المملكة'}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {academies.length > 0
              ? academies.map((a) => (
                  <li key={a.slug} className="flex items-center gap-2 text-fg-subtle transition-colors hover:text-fg-muted">
                    <SafeImage src={a.logo_url} width={28} height={28} className="h-7 w-7 rounded-md object-contain">
                      <Building2 size={22} aria-hidden />
                    </SafeImage>
                    <span className="font-display text-lg">{a.name}</span>
                  </li>
                ))
              : LOGOS.map((l) => (
                  <li key={l.name} className="flex items-center gap-2 text-fg-subtle transition-colors hover:text-fg-muted">
                    <LogoMark shape={l.shape} />
                    <span className="font-display text-lg">{l.name}</span>
                  </li>
                ))}
          </ul>
          <SampleTag show={!useReal || academies.length === 0} />
        </div>
      </div>
    </section>
  );
}

/** Illustrative numbers shown only while the platform has nothing real to report (OD-21). */
const LANDING_SAMPLE_STATS = [
  { value: '+١٢٠', label: 'مركز وأكاديمية' },
  { value: '+٣٨ ألف', label: 'طالب نشط' },
  { value: '٩٨٪', label: 'نسبة حضور مسجّلة رقمياً' },
  { value: '٤٫٨ / ٥', label: 'متوسط رضا المعلمين' },
];
