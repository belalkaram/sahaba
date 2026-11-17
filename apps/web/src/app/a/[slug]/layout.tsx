/**
 * TL-2/TL-3 (ADR-007): Server Component layout for public academy pages.
 *
 * - Fetches the academy profile server-side (ISR, 60s, tagged `tenant-landing-{slug}`).
 * - Derives CSS theme tokens from the published palette and injects them into <head>.
 * - Looks up the template from the registry and renders its Header.
 * - Passes the profile to <AcademyProvider> so all client pages can call useAcademy().
 * - Renders <PoweredByFooter> OUTSIDE template scope — cannot be hidden by any template.
 * - Preview token support deferred to TL-5 (editor flow).
 */
import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AcademyProvider } from '../../../features/public-academy/academy-context';
import { deriveTenantTheme, isValidPalette, DEFAULT_PALETTE } from '../../../lib/theme/derive-tenant-theme';
import { getTemplateEntry } from '../../../features/tenant-landing/registry';
import { PoweredByFooter } from '../../../features/tenant-landing/sections/powered-by-footer';
import { buttonClasses } from '../../../components/ui/button-styles';
import type { AcademyProfile } from '../../../lib/public-api';

function serverApiBase(): string | null {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return /^https?:\/\//.test(base) ? base.replace(/\/$/, '') : null;
}

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

  // Derive CSS theme from published palette; fall back to platform defaults if none published.
  const rawPalette = profile.landing?.palette;
  const palette = isValidPalette(rawPalette) ? rawPalette : DEFAULT_PALETTE;
  const { css: themeCSS } = deriveTenantTheme(palette);

  const templateId = profile.landing?.template ?? 'oasis';
  const { Header } = getTemplateEntry(templateId);

  return (
    <>
      {themeCSS && (
        // React 19 hoists <style> to <head>; `precedence` orders it after global tokens.
        // eslint-disable-next-line react/no-danger
        <style id="tenant-theme" precedence="tenant" dangerouslySetInnerHTML={{ __html: themeCSS }} />
      )}
      <AcademyProvider value={{ ...profile, slug }}>
        {/*
         * data-tenant-theme  → CSS variables scope (ADR-007 §3.2)
         * data-template       → template identifier for future CSS-in-JS / slot targeting
         */}
        <div
          data-tenant-theme
          data-template={templateId}
          className="flex min-h-screen flex-col bg-surface-sunken text-fg"
        >
          <Header />
          <main className="flex-1">{children}</main>
          {/* PoweredByFooter is server-rendered here — outside template, cannot be hidden */}
          <PoweredByFooter academyName={profile.name} />
        </div>
      </AcademyProvider>
    </>
  );
}
