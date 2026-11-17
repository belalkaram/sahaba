'use client';

/**
 * TL-4 (ADR-007): Atlas template header — structured split with info bar.
 *
 * header: 'split' — a thin top bar shows the academy's city / service types,
 * then a main header row with logo-left, nav-centre, actions-right (like oasis),
 * but with sharper outline-style active indicators and sm radius.
 * strokeWidth: 1.75, container: 'outline' on icons.
 * Academic/organised — suits multi-branch centres and universities.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, MapPin, MonitorPlay, Building2 } from 'lucide-react';
import { useAcademy } from '../../../public-academy/academy-context';
import { ThemeSwitcher } from '../../../../components/layout/theme-switcher';
import { buttonClasses } from '../../../../components/ui/button-styles';
import { cn } from '../../../../lib/cn';

export function AtlasHeader() {
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
    <header className="sticky top-0 z-40 border-b border-border bg-surface shadow-sm">
      {/* Info bar: city + service types */}
      <div className="hidden border-b border-border/60 bg-surface-sunken md:block">
        <div className="mx-auto flex max-w-[var(--content-max)] items-center justify-between px-6 py-1 text-xs text-fg-muted">
          <div className="flex items-center gap-4">
            {academy.city && (
              <span className="flex items-center gap-1">
                <MapPin size={11} strokeWidth={1.75} aria-hidden />
                {academy.city}
              </span>
            )}
            {academy.services.includes('online') && (
              <span className="flex items-center gap-1">
                <MonitorPlay size={11} strokeWidth={1.75} aria-hidden />
                أونلاين
              </span>
            )}
            {academy.services.includes('offline') && (
              <span className="flex items-center gap-1">
                <Building2 size={11} strokeWidth={1.75} aria-hidden />
                حضوري
              </span>
            )}
          </div>
          <span className="text-fg-subtle">{academy.name}</span>
        </div>
      </div>

      {/* Main header row */}
      <div className="mx-auto grid h-[64px] max-w-[var(--content-max)] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        {/* Logo + name */}
        <Link href={base} className="flex min-w-0 items-center gap-3 justify-self-start">
          {academy.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academy.logo_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-md border border-border bg-white object-contain p-1"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-md border-2 border-primary bg-transparent text-primary text-sm font-bold">
              {academy.name.slice(0, 2)}
            </span>
          )}
          <span className="truncate font-display text-[1.0625rem] font-semibold text-fg">
            {academy.name}
          </span>
        </Link>

        {/* Centred nav — outline-style active indicator */}
        <nav
          className="hidden items-center justify-center gap-1 md:flex"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l) ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded px-4 py-2 text-[0.9375rem] font-medium transition-colors',
                isActive(l)
                  ? 'border border-primary text-primary bg-transparent'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-self-end">
          <ThemeSwitcher />
          <Link
            href={loginHref}
            className={cn(buttonClasses('primary', 'md'), 'hidden rounded-md sm:inline-flex')}
          >
            تسجيل الدخول
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-muted md:hidden"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open
              ? <X size={20} strokeWidth={1.75} aria-hidden />
              : <Menu size={20} strokeWidth={1.75} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav
          className="border-t border-border bg-surface px-4 pb-4 pt-2 md:hidden"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded px-3 py-3 text-base font-medium',
                isActive(l)
                  ? 'border border-primary text-primary mb-1'
                  : 'text-fg hover:bg-surface-muted',
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={loginHref}
            onClick={() => setOpen(false)}
            className={cn(buttonClasses('primary', 'lg'), 'mt-2 w-full justify-center')}
          >
            تسجيل الدخول
          </Link>
        </nav>
      )}
    </header>
  );
}
