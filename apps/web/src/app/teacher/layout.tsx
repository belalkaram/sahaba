'use client';

/**
 * R7A — Teacher/Staff Experience Layout
 * Protected by ExperienceGuard(admin | staff) and wrapped in unified AppShell.
 */

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceGuard allow={['admin', 'staff']}>
      <AppShell experienceOverride="staff">{children}</AppShell>
    </ExperienceGuard>
  );
}
