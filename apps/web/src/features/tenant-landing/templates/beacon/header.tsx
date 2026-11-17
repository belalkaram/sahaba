'use client';

/**
 * TL-4 (ADR-007): Beacon template header — editorial bar.
 *
 * header: 'bar' — logo on the far left, nav links immediately after (not centred),
 * actions on the far right. Sharp corners (radius: none), bold strokes (strokeWidth: 2),
 * diagonal accent strip using --accent for the active indicator.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { useAcademy } from '../../../public-academy/academy-context';
import { ThemeSwitcher } from '../../../../components/layout/theme-switcher';
import { buttonClasses } from '../../../../components/ui/button-styles';
import { cn } from '../../../../lib/cn';

export function BeaconHeader() {
  const academy = useAcademy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const base = `/a/${academy.slug}`;
  const links = [
    { href: base, label: 'الرئيسية', exact: true },
    { href: `${base}/courses`, label: 'المقررات' },
    { href: `${base}/teachers`, label: 'المدرسون' },
  ];
  const isActive = (l: (typeof links)[number]) =>
    l.exact ? pathname === l.href : pathname.startsWith(l.href);
  const loginHref = `/login?tenant=${encodeURIComponent(academy.slug)}`;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-primary bg-surface shadow-none">
      {/* accent strip — 3px top line in accent colour */}
      <div className="h-[3px] bg-accent" aria-hidden />

      <div className="mx-auto flex h-[62px] max-w-[var(--content-max)] items-center gap-6 px-4 sm:px-6">
        {/* Logo + name — left-anchored */}
        <Link href={base} className="flex shrink-0 items-center gap-3">
          {academy.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academy.logo_url}
              alt=""
              className="h-9 w-9 border border-border bg-white object-contain p-0.5"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center bg-primary text-xs font-bold text-primary-fg">
              {academy.name.slice(0, 2)}
            </span>
          )}
          <span className="font-display text-[1.0625rem] font-semibold text-fg">
            {academy.name}
          </span>
        </Link>

        {/* Vertical divider */}
        <div className="hidden h-5 w-px bg-border md:block" aria-hidden />

        {/* Nav links — immediately after logo (bar pattern) */}
        <nav
          className="hidden flex-1 items-center gap-0.5 md:flex"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l) ? 'page' : undefined}
              className={cn(
                'relative whitespace-nowrap px-4 py-[1.1875rem] text-[0.9375rem] font-semibold transition-colors',
                isActive(l)
                  ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-accent'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="ms-auto flex items-center gap-2">
          <ThemeSwitcher />
          <Link
            href={loginHref}
            className={cn(
              buttonClasses('primary', 'md'),
              'hidden rounded-none sm:inline-flex',
            )}
          >
            <ArrowLeft size={16} aria-hidden />
            تسجيل الدخول
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center text-fg-muted hover:bg-surface-muted md:hidden"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open ? <X size={22} strokeWidth={2} aria-hidden /> : <Menu size={22} strokeWidth={2} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav
          className="border-t-2 border-primary bg-surface px-4 pb-5 pt-2 md:hidden"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                'block border-b border-border px-2 py-3 text-base font-semibold',
                isActive(l) ? 'text-primary' : 'text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={loginHref}
            onClick={() => setOpen(false)}
            className={cn(buttonClasses('primary', 'lg'), 'mt-4 w-full rounded-none justify-center')}
          >
            تسجيل الدخول
          </Link>
        </nav>
      )}
    </header>
  );
}
