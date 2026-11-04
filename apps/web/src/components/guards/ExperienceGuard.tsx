'use client';

/**
 * R1B — ExperienceGuard
 * Client-side guard that checks if the user's experience matches the allowed experiences.
 * Renders an explicit 403 page on mismatch (not a silent redirect).
 *
 * NOTE: The backend is the actual security boundary.
 * This guard controls what users SEE, not what data they can access.
 * All API endpoints enforce authorization server-side.
 */

import React from 'react';
import { homePathFor, useAuth } from '../../context/auth-context';
import { Forbidden } from '../ui/forbidden';
import { ErrorState } from '../ui/error-state';
import { BrandMark } from '../brand/brand-mark';
import type { Experience } from '../../types/auth';

export interface ExperienceGuardProps {
  /** Which experience(s) are allowed to view this layout/page */
  allow: Experience | Experience[];
  children: React.ReactNode;
}

const experienceNames: Record<Experience, string> = {
  admin: 'إدارة المؤسسة',
  staff: 'الكادر التعليمي',
  student: 'الطلاب',
  parent: 'أولياء الأمور',
};

export const ExperienceGuard: React.FC<ExperienceGuardProps> = ({ allow, children }) => {
  const { experience, isLoading, isAuthenticated, sessionUnavailable, retrySession } = useAuth();

  // Session is being restored: show the shell silhouette, never a 403 flash.
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-surface-sunken" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="hidden w-[var(--shell-sidebar)] shrink-0 flex-col gap-3 border-e border-border bg-surface p-4 md:flex">
          <div className="flex items-center gap-3 pb-4">
            <BrandMark size={36} />
            <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-muted" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
        <div className="flex-1">
          <div className="h-16 border-b border-border bg-surface" />
          <div className="mx-auto max-w-[var(--content-max)] space-y-6 p-6 lg:p-8">
            <div className="h-9 w-64 animate-pulse rounded-md bg-surface-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-muted" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (sessionUnavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-sunken p-6">
        <ErrorState
          title="تعذّر تحميل جلستك"
          description="قد يكون الاتصال غير مستقر أو الخادم مشغولاً. لم يتم تسجيل خروجك."
          onRetry={retrySession}
        />
      </div>
    );
  }

  if (!isAuthenticated || !experience) {
    return (
      <div className="min-h-screen bg-surface-sunken">
        <Forbidden
          className="min-h-screen"
          title="يلزم تسجيل الدخول"
          description="انتهت جلستك أو لم تسجّل الدخول بعد. سجّل الدخول للمتابعة."
          homeHref="/login"
          homeLabel="تسجيل الدخول"
        />
      </div>
    );
  }

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(experience)) {
    return (
      <div className="min-h-screen bg-surface-sunken">
        <Forbidden
          className="min-h-screen"
          description={`هذه الصفحة مخصّصة لـ${allowed.map((e) => experienceNames[e]).join(' أو ')}. حسابك الحالي: ${experienceNames[experience]}.`}
          homeHref={homePathFor(experience)}
          homeLabel="العودة إلى لوحتي"
        />
      </div>
    );
  }

  return <>{children}</>;
};
