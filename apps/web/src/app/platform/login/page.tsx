'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Mail } from 'lucide-react';
import { BrandLockup } from '../../../components/brand/brand-mark';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { ThemeSwitcher } from '../../../components/layout/theme-switcher';
import { platformApi } from '../../../lib/platform-api';

/** R7F — sign-in for platform staff (separate from academy accounts). */
export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platformApi.login(email.trim(), password);
      router.replace('/platform/dashboard');
    } catch {
      setError('تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور.');
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-sunken p-6">
      <span className="pattern-overlay [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" aria-hidden />
      <div className="absolute end-4 top-4">
        <ThemeSwitcher />
      </div>
      <Card padding="lg" className="relative w-full max-w-md space-y-6">
        <BrandLockup size={40} />
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-fg">لوحة إدارة المنصة</h1>
          <p className="text-sm text-fg-muted">مخصّصة لفريق تشغيل المنصة فقط، وليست لحسابات الأكاديميات.</p>
        </div>
        <form onSubmit={submit} className="space-y-4" suppressHydrationWarning>
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            dir="ltr"
            required
            inputSize="lg"
            iconPrefix={<Mail size={18} strokeWidth={1.75} aria-hidden />}
          />
          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            dir="ltr"
            required
            inputSize="lg"
            iconPrefix={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
          />
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-subtle px-4 py-3 text-sm text-danger-subtle-fg">
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" size="lg" fullWidth isLoading={busy}>
            تسجيل الدخول
          </Button>
        </form>
      </Card>
    </div>
  );
}
