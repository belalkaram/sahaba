'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Home, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, buttonClasses } from '../components/ui/button';
import { BrandMark } from '../components/brand/brand-mark';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Client runtime error:', error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-sunken p-6">
      <span className="pattern-overlay [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" aria-hidden />
      <div className="relative w-full max-w-lg space-y-6 rounded-xl border border-border bg-surface p-8 text-center shadow-lg md:p-10">
        <div className="flex justify-center">
          <BrandMark size={40} />
        </div>
        <div className="arch relative mx-auto grid h-20 w-16 place-items-center overflow-hidden bg-danger-subtle text-danger">
          <span className="pattern-overlay" aria-hidden />
          <TriangleAlert size={28} strokeWidth={1.75} className="relative" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-fg">حدث خطأ أثناء تحميل الصفحة</h1>
          <p className="text-sm leading-relaxed text-fg-muted">يمكنك إعادة المحاولة، أو العودة إلى الصفحة الرئيسية.</p>
        </div>
        {error?.digest && (
          <p className="text-xs text-fg-subtle">
            رمز الخطأ للدعم الفني: <span className="ltr-isolate font-mono">{error.digest}</span>
          </p>
        )}
        <div className="flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row">
          <Link href="/" className={buttonClasses('secondary', 'lg')}>
            <Home size={18} strokeWidth={1.75} aria-hidden />
            الرئيسية
          </Link>
          <Button size="lg" onClick={() => reset()} icon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    </div>
  );
}
