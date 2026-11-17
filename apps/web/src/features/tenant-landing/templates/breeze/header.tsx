'use client';

/**
 * TL-4 (ADR-007): Breeze template header — centred two-row.
 *
 * header: 'centered' — first row: logo + name centred with actions on right;
 * second row: pill-shaped nav links spread below, centred.
 * radius: 'full', strokeWidth: 1.5, container: 'filled' (accent-subtle bg on icons).
 * Soft and airy — suits schools and young learners.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAcademy } from '../../../public-academy/academy-context';
import { ThemeSwitcher } from '../../../../components/layout/theme-switcher';
import { buttonClasses } from '../../../../components/ui/button-styles';
import { cn } from '../../../../lib/cn';

export function BreezeHeader() {
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
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm shadow-sm border-b border-border/50">
      {/* Row 1: logo + name centred, actions right */}
      <div className="mx-auto flex h-[60px] max-w-[var(--content-max)] items-center justify-between px-4 sm:px-6">
        <Link href={base} className="flex items-center gap-2.5">
          {academy.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academy.logo_url}
              alt=""
              className="h-9 w-9 rounded-full border border-border bg-white object-contain p-1"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-subtle text-accent text-sm font-bold">
              {academy.name.slice(0, 2)}
            </span>
          )}
          <span className="font-display text-[1rem] font-semibold text-fg">{academy.name}</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Link
            href={loginHref}
            className={cn(
              buttonClasses('primary', 'sm'),
              'hidden rounded-full sm:inline-flex',
            )}
          >
            دخول
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full text-fg-muted hover:bg-surface-muted md:hidden"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open
              ? <X size={18} strokeWidth={1.5} aria-hidden />
              : <Menu size={18} strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Row 2: pill nav — hidden on mobile */}
      <div className="hidden border-t border-border/50 md:block">
        <nav
          className="mx-auto flex max-w-[var(--content-max)] items-center justify-center gap-1 px-4 py-1.5 sm:px-6"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l) ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
                isActive(l)
                  ? 'bg-primary text-primary-fg'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile drawer — full-radius elements */}
      {open && (
        <nav
          className="border-t border-border/50 bg-surface px-4 pb-5 pt-3 md:hidden"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          <div className="flex flex-col gap-1.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-full px-4 py-2.5 text-base font-medium text-center transition-colors',
                  isActive(l)
                    ? 'bg-primary text-primary-fg'
                    : 'bg-surface-muted text-fg hover:bg-primary-subtle hover:text-primary-subtle-fg',
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={loginHref}
              onClick={() => setOpen(false)}
              className={cn(buttonClasses('primary', 'md'), 'mt-1 rounded-full w-full justify-center')}
            >
              تسجيل الدخول
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
