'use client';

/**
 * R7A — Parent Experience Layout
 * Protected by ExperienceGuard(parent) and wrapped in unified AppShell.
 */

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceGuard allow="parent">
      <AppShell experienceOverride="parent">{children}</AppShell>
    </ExperienceGuard>
  );
}
