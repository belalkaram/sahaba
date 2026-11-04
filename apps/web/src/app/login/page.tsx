'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Building2, ChevronDown, Eye, EyeOff, KeyRound, Mail, Ticket } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { tokenStore } from '../../lib/token-store';
import { DEMO_LOGIN_MODE } from '../../config/features';
import { publicApi } from '../../lib/public-api';
import { normalizeDigits } from '../../lib/format';
import { Tabs } from '../../components/ui/tabs';
import { BRAND } from '../../config/brand';
import { BrandLockup } from '../../components/brand/brand-mark';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ThemeSwitcher } from '../../components/layout/theme-switcher';
import { IconNext } from '../../components/icons/directional';
import { cn } from '../../lib/cn';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';
import { AuthBrandPanel } from '../../features/auth/auth-brand-panel';

interface DemoAccount {
  role: string;
  name: string;
  email: string;
  tenantSlug: string;
}

/** OD-20: rendered only in development or when a platform admin enables it (fail-closed). */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'طالب', name: 'عمر أحمد', email: 'student@almustaqbal.edu', tenantSlug: 'almustaqbal' },
  { role: 'معلّم', name: 'د. سارة عبد الله', email: 'teacher@almustaqbal.edu', tenantSlug: 'almustaqbal' },
  { role: 'ولي أمر', name: 'أحمد فاروق', email: 'parent@almustaqbal.edu', tenantSlug: 'almustaqbal' },
  { role: 'مدير المؤسسة', name: 'إدارة الأكاديمية', email: 'admin@almustaqbal.edu', tenantSlug: 'almustaqbal' },
];
const DEMO_PASSWORD = 'password123';

function LoginForm() {
  const { login, couponLogin, supportLogin, isLoading, error } = useAuth();
  const searchParams = useSearchParams();

  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [editTenant, setEditTenant] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const exchangedCode = useRef<string | null>(null);
  const [demoVisible, setDemoVisible] = useState(DEMO_LOGIN_MODE === 'on');
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [couponCode, setCouponCode] = useState('');
  const [couponSecret, setCouponSecret] = useState('');

  // OD-20: in production the platform-admin switch decides; any failure keeps it hidden.
  useEffect(() => {
    if (DEMO_LOGIN_MODE !== 'runtime') return;
    publicApi
      .getConfig()
      .then((config) => setDemoVisible(config.demo_login_enabled === true))
      .catch(() => setDemoVisible(false));
  }, []);

  // The academy code comes from the link (?tenant=) or the last academy used on this device.
  useEffect(() => {
    const fromUrl = searchParams?.get('tenant');
    const remembered = tokenStore.getTenant();
    const slug = fromUrl || remembered || '';
    setTenantSlug(slug);
    setEditTenant(!slug);
  }, [searchParams]);

  useEffect(() => {
    const supportCode = searchParams?.get('support_code');
    const slugFromUrl = searchParams?.get('tenant');
    if (supportCode && slugFromUrl && exchangedCode.current !== supportCode) {
      exchangedCode.current = supportCode; // single use: never submit it twice
      supportLogin(supportCode, slugFromUrl);
    }
  }, [searchParams, supportLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = tenantSlug.trim().toLowerCase();
    if (mode === 'code') {
      await couponLogin(normalizeDigits(couponCode.trim()), normalizeDigits(couponSecret.trim()), slug);
      return;
    }
    await login(email.trim(), password, slug);
  };

  const loginAsDemo = async (demo: DemoAccount) => {
    setTenantSlug(demo.tenantSlug);
    setEmail(demo.email);
    setPassword(DEMO_PASSWORD);
    await login(demo.email, DEMO_PASSWORD, demo.tenantSlug);
  };

  const formRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('[data-enter]', { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
    },
    { scope: formRef },
  );

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Form side (inline start = right in RTL) */}
      <div ref={formRef} className="relative flex flex-col px-6 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between" data-enter>
          <Link href="/">
            <BrandLockup size={38} />
          </Link>
          <ThemeSwitcher />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="mb-8 space-y-2" data-enter>
            <h1 className="font-display text-3xl text-fg sm:text-4xl">أهلاً بعودتك</h1>
            <p className="text-base text-fg-muted">سجّل الدخول لمتابعة دروسك وحصصك وتقييماتك.</p>
          </div>

          <div className="mb-5" data-enter>
            <Tabs
              tabs={[
                { id: 'password', label: 'البريد وكلمة المرور' },
                { id: 'code', label: 'كود الدخول' },
              ]}
              activeTab={mode}
              onChange={(id) => setMode(id as 'password' | 'code')}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Academy (tenant) — a technical code, collapsed once known */}
            <div data-enter>
              {editTenant ? (
                <Input
                  label="رمز الأكاديمية"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="مثال: almustaqbal"
                  helperText="تجده في رسالة الترحيب أو لدى إدارة أكاديميتك."
                  autoComplete="organization"
                  dir="ltr"
                  required
                  inputSize="lg"
                  iconPrefix={<Building2 size={18} strokeWidth={1.75} aria-hidden />}
                />
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-primary-subtle text-primary">
                      <Building2 size={18} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-fg-muted">الأكاديمية</span>
                      <span className="ltr-isolate block truncate text-sm font-semibold text-fg">{tenantSlug}</span>
                    </span>
                  </span>
                  <button type="button" onClick={() => setEditTenant(true)} className="text-sm font-semibold text-primary hover:underline">
                    تغيير
                  </button>
                </div>
              )}
            </div>

            {mode === 'code' ? (
              <>
                <Input
                  label="كود الدخول"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="الكود المطبوع على بطاقتك"
                  autoComplete="off"
                  dir="ltr"
                  required
                  inputSize="lg"
                  iconPrefix={<Ticket size={18} strokeWidth={1.75} aria-hidden />}
                />
                <Input
                  label="الرقم السري للكود"
                  type="password"
                  value={couponSecret}
                  onChange={(e) => setCouponSecret(e.target.value)}
                  helperText="يرتبط الكود بجهازك عند أول استخدام."
                  autoComplete="off"
                  dir="ltr"
                  required
                  inputSize="lg"
                  iconPrefix={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
                />
              </>
            ) : (
              <>
            <div data-enter>
              <Input
                label="البريد الإلكتروني"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                dir="ltr"
                required
                inputSize="lg"
                iconPrefix={<Mail size={18} strokeWidth={1.75} aria-hidden />}
              />
            </div>

            <div data-enter>
              <Input
                label="كلمة المرور"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                required
                inputSize="lg"
                iconPrefix={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
                iconSuffix={
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="grid h-8 w-8 place-items-center rounded-sm text-fg-subtle transition-colors hover:text-fg"
                    aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPass ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
                  </button>
                }
              />
            </div>

              </>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-subtle px-4 py-3 text-sm text-danger-subtle-fg">
                <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <div data-enter>
              <Button type="submit" size="lg" fullWidth isLoading={isLoading}>
                {isLoading ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
              </Button>
            </div>
          </form>

          {demoVisible && (
            <div className="mt-8 rounded-lg border border-dashed border-accent/40 bg-accent-subtle" data-enter>
              <button
                type="button"
                onClick={() => setDemoOpen((v) => !v)}
                aria-expanded={demoOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <span>
                  <span className="block text-sm font-semibold text-accent-subtle-fg">حسابات تجريبية</span>
                  <span className="block text-xs text-fg-muted">للتجربة والعرض فقط</span>
                </span>
                <ChevronDown size={18} className={cn('text-fg-muted transition-transform duration-200', demoOpen && 'rotate-180')} aria-hidden />
              </button>
              {demoOpen && (
                <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((demo) => (
                    <button
                      key={demo.email}
                      type="button"
                      onClick={() => loginAsDemo(demo)}
                      disabled={isLoading}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-start transition-colors hover:border-primary/40 hover:bg-primary-subtle disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-fg">{demo.role}</span>
                        <span className="block truncate text-xs text-fg-muted">{demo.name}</span>
                      </span>
                      <IconNext size={16} className="shrink-0 text-fg-subtle" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-sm text-fg-muted" data-enter>
            مؤسسة تعليمية جديدة؟{' '}
            <Link href="/register-school" className="font-semibold text-primary hover:underline">
              سجّل أكاديميتك
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-fg-subtle">
          © {new Date().getFullYear()} {BRAND.nameAr} — {BRAND.taglineAr}
        </p>
      </div>

      {/* Brand side (inline end = left in RTL), hidden on small screens */}
      <AuthBrandPanel />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginForm />
    </Suspense>
  );
}
