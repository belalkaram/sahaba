'use client';

import React from 'react';
import { ExperienceGuard } from '../../../../components/guards/ExperienceGuard';

/**
 * Secure exam area: students only, deliberately WITHOUT the app shell (no sidebar, no top bar,
 * no navigation) so the exam is a dedicated, distraction-free page.
 */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <ExperienceGuard allow="student">{children}</ExperienceGuard>;
}
