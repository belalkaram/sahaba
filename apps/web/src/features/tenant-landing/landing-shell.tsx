'use client';

/**
 * TL-5 (ADR-007): Client shell for the public academy pages.
 *
 * The layout renders the PUBLISHED landing on the server (ISR, tagged per slug). Layouts never
 * receive search params, so the editor's draft preview (`?preview=<token>`) is resolved here in
 * the browser: the profile is re-fetched with the token, and the API returns the draft only when
 * the token is valid (otherwise the published data — the page just stays as it is).
 *
 * Everything that depends on the landing settings — theme tokens, template header, the
 * AcademyProvider value read by the pages — comes from the resolved profile, so a preview swaps
 * all of it at once.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AcademyProvider } from '../public-academy/academy-context';
import { deriveTenantTheme, isValidPalette, DEFAULT_PALETTE } from '../../lib/theme/derive-tenant-theme';
import { publicAcademyApi } from '../../lib/public-api';
import type { AcademyProfile } from '../../lib/public-api';
import { getTemplateEntry } from './registry';

interface Props {
  profile: AcademyProfile;
  children: React.ReactNode;
  /** Server-rendered footer; kept outside the template so no template can hide it. */
  footer: React.ReactNode;
}

export function LandingShell({ profile: initial, children, footer }: Props) {
  const [profile, setProfile] = useState<AcademyProfile>(initial);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('preview');
    if (!token) return;
    let cancelled = false;
    publicAcademyApi
      .academy(initial.slug, token)
      .then((p) => {
        if (cancelled) return;
        setProfile({ ...p, slug: initial.slug });
        setIsPreview(true);
      })
      // Preview is best effort: on failure the published page stays visible.
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [initial.slug]);

  const palette = isValidPalette(profile.landing?.palette) ? profile.landing!.palette : DEFAULT_PALETTE;
  const themeCSS = useMemo(() => deriveTenantTheme(palette).css, [palette]);
  const templateId = profile.landing?.template ?? 'oasis';
  const { Header } = getTemplateEntry(templateId);

  return (
    <>
      {themeCSS && (
        // Rendered in place (not hoisted) so a preview swap replaces the tokens instead of
        // leaving the published ones behind. [data-tenant-theme] outranks the global :root tokens.
        <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: themeCSS }} />
      )}
      <AcademyProvider value={profile}>
        {/*
         * data-tenant-theme  → CSS variables scope (ADR-007 §3.2)
         * data-template       → template identifier for template-specific styling
         */}
        <div
          data-tenant-theme
          data-template={templateId}
          data-preview={isPreview ? '' : undefined}
          className="flex min-h-screen flex-col bg-surface-sunken text-fg"
        >
          <Header />
          <main className="flex-1">{children}</main>
          {footer}
        </div>
      </AcademyProvider>
    </>
  );
}
