'use client';

/**
 * R7A — Admin Experience Layout
 * Protected by ExperienceGuard(admin) and wrapped in unified AppShell.
 */

import React from 'react';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';
import { AppShell } from '../../components/layout/app-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceGuard allow="admin">
      <AppShell experienceOverride="admin">{children}</AppShell>
    </ExperienceGuard>
  );
}
