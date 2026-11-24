import React from 'react';
import type { Metadata } from 'next';
import { PublicPage } from '../../components/layout/public-chrome';
import { DirectoryView } from '../../features/directory/directory-view';
import { getDirectoryPage } from '../../features/landing/server-data';
import type { DirectoryTeacher } from '../../lib/public-api';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'المعلمون',
  description: 'تعرّف على المعلمين الذين فعّلوا ملفهم العام على منصة سحابة، ومقرراتهم المنشورة.',
};

/** Public directory of teachers who switched their own public profile on (PS-2). */
export default async function TeachersPage() {
  const initial = await getDirectoryPage<DirectoryTeacher>('teachers');

  return (
    <PublicPage>
      <div className="mx-auto max-w-[var(--content-max)] px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 max-w-2xl">
          <h1 className="heading-accent font-display text-3xl sm:text-4xl">المعلمون</h1>
          <p className="mt-3 text-base leading-relaxed text-fg-muted">
            كل معلم هنا فعّل ملفه العام بنفسه. افتح صفحته لترى نبذته ومقرراته المنشورة في أكاديميته.
          </p>
        </header>
        <DirectoryView kind="teachers" initial={initial} />
      </div>
    </PublicPage>
  );
}
