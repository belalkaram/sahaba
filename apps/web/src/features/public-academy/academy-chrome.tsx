'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAcademy } from './academy-context';
import { ThemeSwitcher } from '../../components/layout/theme-switcher';
import { BrandMark } from '../../components/brand/brand-mark';
import { buttonClasses } from '../../components/ui/button-styles';
import { BRAND } from '../../config/brand';
import { cn } from '../../lib/cn';

/** Header + footer for an academy's public landing pages. Links are evenly spread in the middle track. */
export function AcademyChrome({ children }: { children: React.ReactNode }) {
  const academy = useAcademy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const base = `/a/${academy.slug}`;
  const links = [
    { href: base, label: 'الرئيسية', exact: true },
    { href: `${base}/courses`, label: 'المقررات' },
    { href: `${base}/teachers`, label: 'المدرسون' },
  ];
  const isActive = (l: (typeof links)[number]) => (l.exact ? pathname === l.href : pathname.startsWith(l.href));
  const loginHref = `/login?tenant=${encodeURIComponent(academy.slug)}`;

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken text-fg">
      <header className="chrome-surface sticky top-0 z-40 border-b border-border shadow-xs">
        <div className="mx-auto grid h-[68px] max-w-[var(--content-max)] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
          <Link href={base} className="flex min-w-0 items-center gap-3 justify-self-start">
            {academy.logo_url ? (
              <img src={academy.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-md border border-border bg-white object-contain p-1" />
            ) : (
              <BrandMark size={44} decorative />
            )}
            <span className="truncate font-display text-lg text-fg">{academy.name}</span>
          </Link>

          <nav className="hidden items-center justify-center gap-1 md:flex" aria-label="التنقل في صفحة الأكاديمية">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l) ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-md px-4 py-2 text-[0.9375rem] font-medium transition-colors',
                  isActive(l) ? 'bg-primary-subtle font-semibold text-primary-subtle-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 justify-self-end">
            <ThemeSwitcher />
            <Link href={loginHref} className={cn(buttonClasses('primary', 'md'), 'hidden sm:inline-flex')}>
              تسجيل الدخول
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-muted md:hidden"
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={open}
            >
              {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="grid gap-1 border-t border-border px-4 pb-4 pt-2 md:hidden" aria-label="التنقل في صفحة الأكاديمية">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-base font-medium text-fg hover:bg-surface-muted">
                {l.label}
              </Link>
            ))}
            <Link href={loginHref} onClick={() => setOpen(false)} className={cn(buttonClasses('primary', 'lg'), 'mt-2')}>
              تسجيل الدخول
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[var(--content-max)] flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm text-fg-muted sm:flex-row sm:px-6 sm:text-start">
          <p className="break-words">© {new Date().getFullYear()} {academy.name}</p>
          <p>
            مدعوم بمنصة <Link href="/" className="font-semibold text-primary hover:underline">{BRAND.nameAr}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
