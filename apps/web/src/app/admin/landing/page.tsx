'use client';

/**
 * TL-5 (ADR-007): Admin landing editor page.
 * Protected by ExperienceGuard(admin) via the parent /admin/layout.
 * Requires tenant.branding — the API enforces this; no frontend gate needed.
 */
import React from 'react';
import { LandingEditor } from '../../../features/tenant-landing/editor/LandingEditor';

export default function AdminLandingPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold text-fg">صفحتي العامة</h1>
        <p className="mt-1 text-sm text-fg-muted">
          خصّص مظهر صفحة أكاديميتك وانشرها — التغييرات تظهر لزوارك خلال دقيقة.
        </p>
      </div>
      <LandingEditor />
    </div>
  );
}
