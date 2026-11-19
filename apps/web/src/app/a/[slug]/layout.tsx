/**
 * TL-2/TL-3 (ADR-007): Server Component layout for public academy pages.
 *
 * - Fetches the academy profile server-side (ISR, 60s, tagged `tenant-landing-{slug}`).
 * - Derives CSS theme tokens from the published palette and injects them into <head>.
 * - Looks up the template from the registry and renders its Header.
 * - Passes the profile to <AcademyProvider> so all client pages can call useAcademy().
 * - Renders <PoweredByFooter> OUTSIDE template scope — cannot be hidden by any template.
 * - The editor's draft preview (?preview=<token>) is resolved client-side in LandingShell,
 *   because layouts do not receive search params; the published page keeps its ISR cache.
 */
import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LandingShell } from '../../../features/tenant-landing/landing-shell';
// Per-template styling of cards, titles and panels below the hero (scoped by [data-template]).
import '../../../features/tenant-landing/templates/templates.css';
import { serverApiBase } from '../../../lib/server-api-base';
import { PoweredByFooter } from '../../../features/tenant-landing/sections/powered-by-footer';
import { buttonClasses } from '../../../components/ui/button-styles';
import type { AcademyProfile } from '../../../lib/public-api';

async function fetchAcademyProfile(slug: string): Promise<AcademyProfile | 'NOT_FOUND' | null> {
  const base = serverApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/public/academy/profile`, {
      headers: { Accept: 'application/json', 'X-Tenant-Slug': slug },
      next: { tags: [`tenant-landing-${slug}`], revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return 'NOT_FOUND';
    if (!res.ok) return null;
    const json = (await res.json()) as { data: AcademyProfile };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Public, unauthenticated academy pages. The academy is identified by the URL slug only. */
export default async function AcademyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await fetchAcademyProfile(slug);

  if (profile === 'NOT_FOUND') {
    notFound();
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken px-4 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-fg">تعذّر تحميل صفحة الأكاديمية</h1>
          <p className="text-fg-muted">تحقق من الاتصال ثم أعد المحاولة.</p>
          <Link href="/" className={buttonClasses('primary', 'md')}>
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  // Theme tokens, template header and the draft preview (?preview=) are resolved in LandingShell.
  return (
    <LandingShell profile={{ ...profile, slug }} footer={<PoweredByFooter academyName={profile.name} />}>
      {children}
    </LandingShell>
  );
}
