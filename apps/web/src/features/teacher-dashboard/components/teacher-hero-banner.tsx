'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpenIcon, UsersIcon } from '../../../components/icons';

export interface TeacherHeroBannerProps {
  name: string;
}

export const TeacherHeroBanner: React.FC<TeacherHeroBannerProps> = ({ name }) => {
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface border border-border shadow-xs flex flex-col">
      <div className="sadu w-full" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 flex-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-xs bg-primary-subtle text-primary px-2.5 py-0.5 text-xs font-semibold">
              بوابة الكادر التعليمي
            </span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-fg tracking-tight">
            مرحباً بك، {name}  
 </h1>
          <p className="mt-2 text-xs sm:text-sm text-fg-muted max-w-xl leading-relaxed">
            متابعة الحصص الدراسية، تسجيل حضور الطلاب بالباركود الآمن، وتدقيق الواجبات والمدفوعات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/teacher/courses">
            <button className="flex items-center justify-center gap-2 rounded-md bg-primary text-primary-fg px-5 py-2.5 font-bold text-xs hover:bg-primary-hover transition-colors shadow-xs">
              <BookOpenIcon size={16} />
              إدارة المقررات
            </button>
          </Link>
          <Link href="/teacher/students">
            <button className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 font-semibold text-xs text-fg hover:bg-surface-raised transition-colors">
              <UsersIcon size={16} />
              سجل الطلاب
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

