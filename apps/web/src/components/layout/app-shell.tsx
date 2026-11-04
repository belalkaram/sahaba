'use client';

/**
 * R7-1 — Unified AppShell (all experiences: admin, staff, student, parent, platform).
 *
 * - Sidebar on the inline-start edge (right in RTL): brand, tenant, grouped navigation from the
 *   navigation registry, collapsible to an icon rail (persisted), active indicator that slides.
 * - Top bar: quick navigation search (Ctrl/⌘+K), theme switcher, notifications slot, user menu.
 * - Mobile: compact top bar + bottom navigation (registry `primary` items) + "More" sheet.
 * - Page entry animation on route change (GSAP, reduced-motion aware).
 * - No hardcoded identity fallbacks: names come from the auth session only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronsLeft, LogOut, Menu, MoreHorizontal, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { filterNavItems, NAV_GROUP_LABELS, type NavGroup, type NavItem } from '../../config/navigation-registry';
import { navIcon } from '../../config/nav-icons';
import { BRAND } from '../../config/brand';
import { SupportSessionBanner } from './support-session-banner';
import { ThemeSwitcher } from './theme-switcher';
import { CommandPalette } from './command-palette';
import { NotificationBell } from './notification-bell';
import { Avatar } from '../ui/avatar';
import { BrandMark } from '../brand/brand-mark';
import { cn } from '../../lib/cn';
import { readableBrandColor } from '../../lib/brand-color';
import { onPartialFailure } from '../../lib/partial-failure';
import { gsap, useGSAP, MOTION, prefersReducedMotion } from '../../lib/motion';
import type { Experience } from '../../types/auth';

const experienceLabels: Record<Experience, string> = {
  admin: 'مدير المؤسسة',
  staff: 'الكادر التعليمي',
  student: 'طالب',
  parent: 'ولي أمر',
};

const GROUP_ORDER: NavGroup[] = ['home', 'learning', 'teaching', 'finance', 'management', 'account', 'platform'];
const COLLAPSE_KEY = 'sahaba_sidebar_collapsed';

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
}

function groupItems(items: NavItem[]) {
  return GROUP_ORDER.map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter((g) => g.items.length);
}

export interface AppShellProps {
  children: React.ReactNode;
  experienceOverride?: Experience;
  area?: 'tenant' | 'platform';
  /** Platform staff are not tenant users: their identity comes from the platform session. */
  identity?: { name: string; onLogout: () => void };
}

export const AppShell: React.FC<AppShellProps> = ({ children, experienceOverride, area = 'tenant', identity }) => {
  const { session, experience: authExp, permissions, tenant, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const activeExperience: Experience = experienceOverride || authExp || 'student';
  const navItems = useMemo(
    () => filterNavItems(activeExperience, tenant?.modules ?? [], permissions, area),
    [activeExperience, tenant?.modules, permissions, area],
  );
  const groups = useMemo(() => groupItems(navItems), [navItems]);
  const mobilePrimary = useMemo(() => navItems.filter((i) => i.primary).slice(0, 4), [navItems]);

  const user = session?.user;
  const displayName = identity?.name ?? (user?.name || user?.email || '');
  const handleLogout = identity?.onLogout ?? logout;
  const roleLabel = area === 'platform' ? 'مشرف المنصة' : experienceLabels[activeExperience];
  const contextName = area === 'platform' ? `منصة ${BRAND.nameAr}` : tenant?.name;

  // Persisted sidebar collapse
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      setCollapsed(false);
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        // ignore storage failures
      }
      return !v;
    });
  };

  // Tenant brand color (the academy's own color) applies inside its workspace only.
  useEffect(() => {
    const root = document.documentElement;
    const color = area === 'tenant' ? readableBrandColor(tenant?.branding?.primary_color) : null;
    if (color) root.style.setProperty('--brand-primary', color);
    else root.style.removeProperty('--brand-primary');
  }, [tenant?.branding?.primary_color, area]);

  // Ctrl/⌘+K opens quick navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

  // Rule §4: tell the user when part of the page failed to load instead of showing it as empty.
  const [partialFailure, setPartialFailure] = useState(false);
  useEffect(() => onPartialFailure(() => setPartialFailure(true)), []);
  useEffect(() => setPartialFailure(false), [pathname]);

  // Page entry: header first, then content blocks in sequence.
  const mainRef = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const wrapper = mainRef.current?.firstElementChild;
      if (!wrapper) return;
      // Pages usually render one root element; animate its sections rather than the root.
      const root = wrapper.children.length === 1 ? (wrapper.firstElementChild ?? wrapper) : wrapper;
      const blocks = Array.from(root.children).slice(0, MOTION.staggerCap);
      if (!blocks.length) return;
      const reduced = prefersReducedMotion();
      gsap.from(blocks, {
        autoAlpha: 0,
        y: reduced ? 0 : 10,
        duration: reduced ? MOTION.duration.fast : MOTION.duration.slow,
        stagger: reduced ? 0 : 0.06,
        clearProps: 'transform,opacity,visibility',
      });
    },
    { scope: mainRef, dependencies: [pathname] },
  );

  // Sliding active indicator in the sidebar.
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const placeIndicator = useCallback((animate: boolean) => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      gsap.set(indicator, { autoAlpha: 0 });
      return;
    }
    const vars = { y: active.offsetTop + 8, height: active.offsetHeight - 16, autoAlpha: 1 };
    if (animate && !prefersReducedMotion()) gsap.to(indicator, { ...vars, duration: MOTION.duration.base, ease: MOTION.ease.out });
    else gsap.set(indicator, vars);
  }, []);
  const indicatorPlaced = useRef(false);
  useEffect(() => {
    placeIndicator(indicatorPlaced.current);
    indicatorPlaced.current = true;
  }, [pathname, collapsed, navItems, placeIndicator]);

  const renderNavLink = (item: NavItem, opts: { compact?: boolean; onClick?: () => void } = {}) => {
    const Icon = navIcon(item.iconName);
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={opts.onClick}
        aria-current={active ? 'page' : undefined}
        title={opts.compact ? item.label : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-150',
          opts.compact ? 'h-11 justify-center' : 'h-10 px-3',
          active ? 'bg-primary-subtle text-primary-subtle-fg font-semibold' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        )}
      >
        <Icon size={18} strokeWidth={active ? 2 : 1.75} className="shrink-0" aria-hidden />
        {!opts.compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken text-fg">
      <SupportSessionBanner />

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'chrome-surface sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-e border-border shadow-[inset_-1px_0_0_rgba(255,255,255,0.35)] transition-[width] duration-300 ease-out md:flex',
            collapsed ? 'w-[var(--shell-sidebar-collapsed)]' : 'w-[var(--shell-sidebar)]',
          )}
          aria-label="القائمة الجانبية"
        >
          <div className="sadu w-full shrink-0" aria-hidden />

          {/* Brand */}
          <div className={cn('flex h-[68px] shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-5')}>
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={BRAND.nameAr}>
              <BrandMark size={collapsed ? 40 : 50} decorative />
              {!collapsed && (
                <span className="leading-none">
                  <span className="block font-display text-[1.375rem] text-fg">{BRAND.nameAr}</span>
                  <span className="ltr-isolate mt-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
                    {BRAND.nameEn}
                  </span>
                </span>
              )}
            </Link>
          </div>

          {/* Tenant context */}
          {!collapsed && (
            <div className="shrink-0 px-3 pt-3">
              <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                {tenant?.branding?.logo_url && area === 'tenant' ? (
                  <img src={tenant.branding.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-sm border border-border bg-white object-contain p-0.5" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary-subtle text-sm font-bold text-primary-subtle-fg" aria-hidden>
                    {(contextName ?? BRAND.nameAr).slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 leading-tight">
                  {contextName ? (
                    <span className="block truncate text-sm font-semibold text-fg">{contextName}</span>
                  ) : (
                    <span className="block h-3 w-24 animate-pulse rounded-sm bg-surface-muted" aria-hidden />
                  )}
                  <span className="block truncate text-xs text-fg-muted">{roleLabel}</span>
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]" aria-label="التنقل الرئيسي">
            <span
              ref={indicatorRef}
              aria-hidden
              className="pointer-events-none absolute start-1 top-0 w-[3px] rounded-full bg-primary opacity-0"
            />
            {groups.map(({ group, items }) => (
              <div key={group} className="mb-4 last:mb-0">
                {!collapsed && items.length > 0 && group !== 'home' && (
                  <p className="mb-1.5 px-3 text-[0.6875rem] font-bold uppercase tracking-wide text-fg-subtle">{NAV_GROUP_LABELS[group]}</p>
                )}
                {collapsed && group !== 'home' && <div className="mx-3 mb-2 border-t border-border-subtle" aria-hidden />}
                <div className="space-y-0.5">{items.map((item) => renderNavLink(item, { compact: collapsed }))}</div>
              </div>
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="shrink-0 border-t border-border p-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                'flex h-10 w-full items-center gap-3 rounded-md text-sm text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg',
                collapsed ? 'justify-center' : 'px-3',
              )}
              aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
              aria-expanded={!collapsed}
            >
              {/* In RTL the sidebar sits on the right: "collapse" points toward it. */}
              <ChevronsLeft
                size={18}
                strokeWidth={1.75}
                className={cn('icon-dir shrink-0 transition-transform duration-300', !collapsed && 'rotate-180')}
                aria-hidden
              />
              {!collapsed && <span>طي القائمة</span>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="chrome-surface sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-border px-4 shadow-xs sm:px-6">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg md:hidden"
              aria-label="فتح القائمة"
            >
              <Menu size={20} strokeWidth={1.75} aria-hidden />
            </button>
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <BrandMark size={40} decorative />
              <span className="font-display text-lg text-fg">{BRAND.nameAr}</span>
            </Link>

            {/* Quick navigation */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-md border border-border bg-surface-raised px-3 text-sm text-fg-subtle transition-colors hover:border-primary/40 md:flex"
            >
              <Search size={16} strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-start">انتقال سريع إلى صفحة…</span>
              <kbd className="ltr-isolate rounded-xs border border-border bg-surface px-1.5 font-sans text-xs text-fg-subtle">Ctrl K</kbd>
            </button>

            <div className="ms-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg md:hidden"
                aria-label="بحث"
              >
                <Search size={18} strokeWidth={1.75} aria-hidden />
              </button>
              <ThemeSwitcher />
              {area === 'tenant' && <NotificationBell />}
              <UserMenu
                name={displayName}
                role={roleLabel}
                profileHref={activeExperience === 'student' && area === 'tenant' ? '/student/profile' : undefined}
                onLogout={handleLogout}
              />
            </div>
          </header>

          <main ref={mainRef} className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
            <div className="mx-auto w-full max-w-[var(--content-max)] space-y-6">
              {partialFailure && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-subtle-fg">
                  <span>تعذّر تحميل جزء من بيانات هذه الصفحة، وقد تظهر بعض الأقسام فارغة.</span>
                  <button type="button" onClick={() => window.location.reload()} className="shrink-0 font-semibold underline">
                    إعادة المحاولة
                  </button>
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="chrome-surface fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="التنقل السفلي"
      >
        {mobilePrimary.map((item) => {
          const Icon = navIcon(item.iconName);
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
                active ? 'text-primary' : 'text-fg-muted',
              )}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden />}
              <Icon size={20} strokeWidth={active ? 2 : 1.75} aria-hidden />
              <span className="max-w-[72px] truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-fg-muted"
        >
          <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden />
          <span>المزيد</span>
        </button>
      </nav>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <MobileSheet onClose={() => setMoreOpen(false)} title={contextName ?? BRAND.nameAr}>
          {groups.map(({ group, items }) => (
            <div key={group} className="mb-4">
              <p className="mb-1.5 px-3 text-xs font-semibold text-fg-subtle">{NAV_GROUP_LABELS[group]}</p>
              <div className="space-y-0.5">{items.map((item) => renderNavLink(item, { onClick: () => setMoreOpen(false) }))}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              handleLogout();
            }}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-danger/30 text-sm font-semibold text-danger hover:bg-danger-subtle"
          >
            <LogOut size={16} aria-hidden />
            تسجيل الخروج
          </button>
        </MobileSheet>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={navItems}
        onSelect={(href) => {
          setPaletteOpen(false);
          router.push(href);
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------------- */

function UserMenu({
  name,
  role,
  profileHref,
  onLogout,
}: {
  name: string;
  role: string;
  profileHref?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ms-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-md p-1 ps-1 transition-colors hover:bg-surface-muted sm:pe-3"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden text-start leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-fg">{name}</span>
          <span className="block text-xs text-fg-muted">{role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-60 rounded-md border border-border bg-surface-raised p-1 shadow-lg">
          <div className="border-b border-border-subtle px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-fg">{name}</p>
            <p className="text-xs text-fg-muted">{role}</p>
          </div>
          {profileHref && (
            <Link
              href={profileHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-fg hover:bg-surface-muted"
            >
              <UserRound size={16} strokeWidth={1.75} aria-hidden />
              الملف الشخصي والأجهزة
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}

function MobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(backdropRef.current, { autoAlpha: 0, duration: MOTION.duration.base });
    gsap.from(panelRef.current, { yPercent: 100, duration: 0.35, ease: MOTION.ease.out });
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div ref={backdropRef} className="absolute inset-0 bg-surface-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة"
        className="chrome-surface absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-border px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
        <div className="mb-3 flex items-center justify-between px-3">
          <span className="text-sm font-semibold text-fg">{title}</span>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted" aria-label="إغلاق">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
