'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { BrandLockup } from '../brand/brand-mark';
import { ThemeSwitcher } from './theme-switcher';
import { buttonClasses } from '../ui/button';
import { BRAND } from '../../config/brand';
import { cn } from '../../lib/cn';

const NAV = [
  { href: '/#features', label: 'المزايا' },
  { href: '/#how', label: 'كيف تعمل' },
  { href: '/pricing', label: 'الأسعار' },
  { href: '/about', label: 'عن سحابة' },
  { href: '/contact', label: 'تواصل معنا' },
];

/** Shared header for public pages (landing, pricing, about, contact, legal, register). */
export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'chrome-surface sticky top-0 z-40 border-b transition-shadow duration-300',
        scrolled ? 'border-border shadow-md' : 'border-border/60 shadow-none',
      )}
    >
      {/* 3 equal tracks: brand | centered links | actions — links stay optically centered at any width */}
      <div className="mx-auto grid h-[68px] max-w-[var(--content-max)] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:h-[76px] lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="justify-self-start" aria-label={BRAND.nameAr}>
          <BrandLockup size={52} />
        </Link>

        <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="روابط الموقع">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative whitespace-nowrap rounded-md px-4 py-2 text-[0.9375rem] font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          <ThemeSwitcher />
          <span className="hidden items-center gap-2 sm:flex">
            <Link href="/login" className={buttonClasses('ghost', 'md')}>
              تسجيل الدخول
            </Link>
            <Link href="/register-school" className={buttonClasses('primary', 'md')}>
              سجّل أكاديميتك
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-muted lg:hidden"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-2 shadow-md lg:hidden">
          <nav className="grid gap-1" aria-label="روابط الموقع">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-base font-medium text-fg hover:bg-surface-muted">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/login" className={buttonClasses('secondary', 'lg')}>
              تسجيل الدخول
            </Link>
            <Link href="/register-school" className={buttonClasses('primary', 'lg')}>
              سجّل أكاديميتك
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="sadu w-full opacity-70" aria-hidden />
      <div className="mx-auto grid max-w-[var(--content-max)] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <BrandLockup size={40} />
          <p className="max-w-sm text-sm leading-relaxed text-fg-muted">{BRAND.descriptionAr}</p>
        </div>
        <FooterCol title="المنصة" links={[['المزايا', '/#features'], ['الأسعار', '/pricing'], ['سجّل أكاديميتك', '/register-school']]} />
        <FooterCol title="الشركة" links={[['عن سحابة', '/about'], ['تواصل معنا', '/contact']]} />
        <FooterCol title="قانوني" links={[['سياسة الخصوصية', '/privacy'], ['الشروط والأحكام', '/terms']]} />
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto max-w-[var(--content-max)] px-4 py-5 text-xs text-fg-subtle sm:px-6">
          © {new Date().getFullYear()} {BRAND.nameAr} <span className="ltr-isolate">({BRAND.nameEn})</span> — جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-bold text-fg">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-fg-muted transition-colors hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shell for public content pages. */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
