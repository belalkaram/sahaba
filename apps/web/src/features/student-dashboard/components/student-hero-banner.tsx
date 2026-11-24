'use client';

import React from 'react';
import Link from 'next/link';
import { VideoIcon, BookOpenIcon } from '../../../components/icons';
import type { Meeting } from '../../../types';

export interface StudentHeroBannerProps {
  name: string;
  studentCode: string;
  meetings: Meeting[];
}

export const StudentHeroBanner: React.FC<StudentHeroBannerProps> = ({
  name,
  studentCode,
  meetings,
}) => {
  return (
    <div className="glass relative overflow-hidden rounded-2xl flex min-h-[290px] flex-col">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 p-7 sm:px-[52px] sm:py-12 flex-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-sm font-semibold text-accent">
              طالب نشط
            </span>
            <span className="text-xs text-fg-muted font-mono">{studentCode}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl sm:text-[44px] leading-tight text-fg-strong">
            أهلاً بك، {name}  
 </h1>
          <p className="mt-3 text-sm sm:text-base text-fg-muted max-w-xl leading-relaxed">
            منصتك الأكاديمية المتكاملة: استكمل دروسك المسجلة، تابع حصصك المباشرة، وحقق أعلى الدرجات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {meetings.length > 0 && (
            <a
              href={meetings[0].join_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex h-[var(--control-h-lg)] items-center justify-center gap-2 rounded-full px-7 font-bold text-sm transition-[filter] hover:brightness-105"
            >
              <VideoIcon size={16} />
              دخول المحاضرة المباشرة
            </a>
          )}
          <Link href="/student/courses" className="flex h-[var(--control-h-lg)] items-center justify-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-7 font-semibold text-sm text-fg shadow-[var(--glass-highlight)] hover:bg-surface-raised transition-colors">
              <BookOpenIcon size={16} />
              استعراض المقررات
            </Link>
        </div>
      </div>
    </div>
  );
};

