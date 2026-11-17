'use client';

/**
 * TL-4 (ADR-007): Horizon template header — minimal.
 *
 * header: 'minimal' — logo + name on the left, sparse nav links on the right,
 * no background/shadow until scrolled past the fold (via CSS class toggle), just
 * a hairline bottom border. Very spacious, motion: none.
 * radius: 'sm', strokeWidth: 1.5, container: 'none'.
 * Suits independent teachers who want maximum focus on their content.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAcademy } from '../../../public-academy/academy-context';
import { ThemeSwitcher } from '../../../../components/layout/theme-switcher';
import { buttonClasses } from '../../../../components/ui/button-styles';
import { cn } from '../../../../lib/cn';

export function HorizonHeader() {
  const academy = useAcademy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-all duration-200',
        scrolled
          ? 'border-border bg-surface/97 backdrop-blur-sm shadow-xs'
          : 'border-border/40 bg-surface',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[var(--content-max)] items-center justify-between px-4 sm:px-8">
        {/* Logo + name — minimal identity */}
        <Link href={base} className="flex items-center gap-3">
          {academy.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academy.logo_url}
              alt=""
              className="h-9 w-9 rounded object-contain"
            />
          ) : (
            <span className="font-display text-xl font-light text-primary">
              {academy.name.slice(0, 1)}
            </span>
          )}
          <span className="font-display text-[1.0625rem] font-light tracking-wide text-fg">
            {academy.name}
          </span>
        </Link>

        {/* Desktop: nav links — right-side, text-only, no containers */}
        <div className="hidden items-center gap-1 md:flex">
          <nav
            className="flex items-center gap-1"
            aria-label="التنقل في صفحة الأكاديمية"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l) ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded px-4 py-2 text-sm transition-colors',
                  isActive(l)
                    ? 'font-medium text-fg underline underline-offset-4 decoration-primary decoration-2'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="mx-3 h-4 w-px bg-border" aria-hidden />

          <ThemeSwitcher />
          <Link
            href={loginHref}
            className={cn(buttonClasses('secondary', 'sm'), 'rounded')}
          >
            دخول
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded text-fg-muted hover:bg-surface-muted"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open
              ? <X size={20} strokeWidth={1.5} aria-hidden />
              : <Menu size={20} strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile drawer — minimal / spacious */}
      {open && (
        <nav
          className="border-t border-border/50 bg-surface px-6 pb-6 pt-4 md:hidden"
          aria-label="التنقل في صفحة الأكاديمية"
        >
          <div className="space-y-0.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block py-3 text-base',
                  isActive(l)
                    ? 'font-medium text-fg underline underline-offset-4 decoration-primary decoration-2'
                    : 'text-fg-muted',
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            href={loginHref}
            onClick={() => setOpen(false)}
            className={cn(buttonClasses('secondary', 'lg'), 'mt-5 w-full justify-center rounded')}
          >
            تسجيل الدخول
          </Link>
        </nav>
      )}
    </header>
  );
}
