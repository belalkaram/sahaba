'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { publicAcademyApi } from '../../../lib/public-api';
import { AcademyProvider } from '../../../features/public-academy/academy-context';
import { AcademyChrome } from '../../../features/public-academy/academy-chrome';
import { usePublicData } from '../../../features/public-academy/use-public-data';
import { ErrorState } from '../../../components/ui/error-state';
import { buttonClasses } from '../../../components/ui/button-styles';

/** Public, unauthenticated academy pages. The academy is identified by the URL slug only. */
export default function AcademyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const state = usePublicData(() => publicAcademyApi.academy(slug), [slug]);

  if (state.status === 'loading') {
    return <div className="min-h-screen bg-surface-sunken" aria-busy="true" />;
  }
  if (state.status === 'not_found') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken px-4 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-fg">الأكاديمية غير موجودة</h1>
          <p className="text-fg-muted">تأكد من صحة الرابط، أو تواصل مع الأكاديمية للحصول على الرابط الصحيح.</p>
          <Link href="/" className={buttonClasses('primary', 'md')}>
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken px-4">
        <ErrorState title="تعذّر تحميل صفحة الأكاديمية" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={state.retry} />
      </div>
    );
  }

  const a = state.data;
  return (
    <AcademyProvider value={{ slug, name: a.name, logo_url: a.logo_url, brand_tagline: a.brand_tagline }}>
      <AcademyChrome>{children}</AcademyChrome>
    </AcademyProvider>
  );
}
