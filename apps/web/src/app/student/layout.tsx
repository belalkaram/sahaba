'use client';

/**
 * R7A — Student Experience Layout
 * Protected by ExperienceGuard(student) and wrapped in unified AppShell.
 */

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceGuard allow="student">
      <AppShell experienceOverride="student">{children}</AppShell>
    </ExperienceGuard>
  );
}
