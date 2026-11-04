'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';

/** R8-2 — notification center, available to every signed-in tenant user. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceGuard allow={['admin', 'staff', 'student', 'parent']}>
      <AppShell>{children}</AppShell>
    </ExperienceGuard>
  );
}
