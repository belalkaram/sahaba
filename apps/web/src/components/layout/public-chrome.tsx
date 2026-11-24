'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { BrandLockup } from '../brand/brand-mark';
import { ThemeSwitcher } from './theme-switcher';
import { buttonClasses } from '../ui/button';
import { BRAND } from '../../config/brand';
import { cn } from '../../lib/cn';

const NAV = [
  { href: '/academies', label: 'الأكاديميات' },
  { href: '/teachers', label: 'المعلمون' },
  { href: '/#features', label: 'المزايا' },
  { href: '/pricing', label: 'الأسعار' },
  { href: '/about', label: 'عن سحابة' },
  { href: '/contact', label: 'تواصل معنا' },
];

/** Shared header for public pages (landing, pricing, about, contact, legal, register). */
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const openRef = useRef(false);
  openRef.current = open;

  // Scroll work writes to the DOM directly: a header that re-rendered on every scroll event was
  // the main cost of this page.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }
      // Give the page back its full height while reading down; bring the header back on the way up.
      const hide = !openRef.current && y > 180 && y > lastY + 4;
      header.style.transform = hide ? 'translateY(calc(-100% - 12px))' : 'translateY(0)';
      lastY = y;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Opening the menu must never leave the header off-screen.
  useEffect(() => {
    if (open && headerRef.current) headerRef.current.style.transform = 'translateY(0)';
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-3 z-40 mx-3 sm:mx-6',
        'transition-[transform,box-shadow] duration-300 will-change-transform motion-reduce:transition-none',
      )}
    >
      {/* Floating glass pill (Emerald Glass): same glass, border and shadow as the app sidebar. */}
      <div
        className={cn(
          'chrome-surface relative mx-auto max-w-[var(--content-max)] overflow-hidden border border-[var(--glass-border)] shadow-[var(--glass-shadow)] transition-[border-radius] duration-300',
          open ? 'rounded-xl' : 'rounded-full',
        )}
      >
      <span ref={progressRef} aria-hidden className="absolute inset-x-6 bottom-0 h-0.5 origin-right scale-x-0 rounded-full bg-primary" />
      {/* 3 equal tracks: brand | centered links | actions — links stay optically centered at any width */}
      <div className="grid h-[64px] grid-cols-[1fr_auto] items-center gap-4 ps-5 pe-3 sm:ps-6 lg:h-[72px] xl:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="justify-self-start">
          <BrandLockup size={46} />
        </Link>

        <nav className="hidden items-center justify-center gap-0.5 xl:flex" aria-label="روابط الموقع">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative whitespace-nowrap rounded-full px-3.5 py-2 text-[0.9375rem] font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          <ThemeSwitcher />
          <span className="hidden items-center gap-2 sm:flex">
            <Link href="/login" className={buttonClasses('ghost', 'md', 'rounded-full!')}>
              تسجيل الدخول
            </Link>
            <Link href="/register-school" className={buttonClasses('primary', 'md', 'rounded-full!')}>
              سجّل أكاديميتك
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-fg-muted hover:bg-surface-muted xl:hidden"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-2 xl:hidden">
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
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="sadu w-full opacity-70" aria-hidden />
      <div className="mx-auto grid max-w-[var(--content-max)] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <BrandLockup size={40} />
          <p className="max-w-sm text-sm leading-relaxed text-fg-muted">{BRAND.descriptionAr}</p>
        </div>
        <FooterCol title="المنصة" links={[['المزايا', '/#features'], ['كيف تعمل', '/#how'], ['الأسعار', '/pricing'], ['سجّل أكاديميتك', '/register-school']]} />
        <FooterCol title="استكشف" links={[['الأكاديميات', '/academies'], ['المعلمون', '/teachers'], ['الأسئلة الشائعة', '/#faq']]} />
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
    <div className="relative isolate flex min-h-screen flex-col">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
