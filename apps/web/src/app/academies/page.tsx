import React from 'react';
import type { Metadata } from 'next';
import { PublicPage } from '../../components/layout/public-chrome';
import { DirectoryView } from '../../features/directory/directory-view';
import { getDirectoryPage } from '../../features/landing/server-data';
import type { DirectoryAcademy } from '../../lib/public-api';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'الأكاديميات',
  description: 'تصفّح المراكز والأكاديميات والمدرسين المستقلين الذين يعملون على منصة سحابة.',
};

/** Public directory of academies that opted into being listed (OD-40). */
export default async function AcademiesPage() {
  const initial = await getDirectoryPage<DirectoryAcademy>('academies');

  return (
    <PublicPage>
      <div className="mx-auto max-w-[var(--content-max)] px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 max-w-2xl">
          <h1 className="heading-accent font-display text-3xl sm:text-4xl">الأكاديميات على سحابة</h1>
          <p className="mt-3 text-base leading-relaxed text-fg-muted">
            مراكز وأكاديميات ومدرسون مستقلون اختاروا الظهور في الدليل. افتح صفحة أي منهم لتصفّح مقرراته ومعلميه وطريقة التسجيل.
          </p>
        </header>
        <DirectoryView kind="academies" initial={initial} />
      </div>
    </PublicPage>
  );
}
