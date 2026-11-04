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
    <div className="relative overflow-hidden rounded-lg bg-surface border border-border shadow-xs flex flex-col">
      <div className="sadu w-full" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 flex-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-xs bg-primary-subtle text-primary px-2.5 py-0.5 text-xs font-semibold">
              طالب نشط
            </span>
            <span className="text-xs text-fg-muted font-mono">{studentCode}</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-fg tracking-tight">
            أهلاً بك، {name}  
 </h1>
          <p className="mt-2 text-xs sm:text-sm text-fg-muted max-w-xl leading-relaxed">
            منصتك الأكاديمية المتكاملة: استكمل دروسك المسجلة، تابع حصصك المباشرة، وحقق أعلى الدرجات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {meetings.length > 0 && (
            <a
              href={meetings[0].join_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-md bg-primary text-primary-fg px-5 py-2.5 font-bold text-xs hover:bg-primary-hover transition-colors shadow-xs"
            >
              <VideoIcon size={16} />
              دخول المحاضرة المباشرة
            </a>
          )}
          <Link href="/student/courses">
            <button className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 font-semibold text-xs text-fg hover:bg-surface-raised transition-colors">
              <BookOpenIcon size={16} />
              استعراض المقررات
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

