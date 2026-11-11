import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { PublicPage } from '../../../components/layout/public-chrome';
import { RegistrationStatusCheck } from '../../../features/registration/status-check';

export const metadata: Metadata = { title: 'متابعة طلب التسجيل' };

/** Public page: a student checks a registration request with the academy code, the reference and their mobile. */
export default function RegistrationStatusPage() {
  return (
    <PublicPage>
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 space-y-2 text-center">
          <h1 className="font-display text-3xl text-fg">متابعة طلب التسجيل</h1>
          <p className="text-fg-muted">أدخل رمز الأكاديمية ورقم الطلب اللذين ظهرا لك بعد التسجيل، ورقم جوال الطالب.</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />}>
            <RegistrationStatusCheck />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-fg-muted">
          لم تسجّل بعد؟{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            سجّل كطالب جديد
          </Link>
        </p>
      </div>
    </PublicPage>
  );
}
