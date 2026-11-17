'use client';

/**
 * R7A — Teacher/Staff Experience Layout
 * Protected by ExperienceGuard(admin | staff) and wrapped in unified AppShell.
 */

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { ExperienceGuard } from '../../components/guards/ExperienceGuard';
import { useAuth } from '../../context/auth-context';

export default function Layout({ children }: { children: React.ReactNode }) {
  // Admins also reach shared pages here (e.g. /teacher/credentials). Forcing "staff" for them
  // swapped the whole admin sidebar for the much shorter staff one.
  const { experience } = useAuth();
  return (
    <ExperienceGuard allow={['admin', 'staff']}>
      <AppShell experienceOverride={experience === 'admin' ? 'admin' : 'staff'}>{children}</AppShell>
    </ExperienceGuard>
  );
}
