'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpenIcon, UsersIcon } from '../../../components/icons';

export interface TeacherHeroBannerProps {
  name: string;
}

export const TeacherHeroBanner: React.FC<TeacherHeroBannerProps> = ({ name }) => {
  return (
    <div className="glass relative overflow-hidden rounded-2xl flex min-h-[290px] flex-col">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 p-7 sm:px-[52px] sm:py-12 flex-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-sm font-semibold text-accent">
              بوابة الكادر التعليمي
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl sm:text-[44px] leading-tight text-fg-strong">
            مرحباً بك، {name}  
 </h1>
          <p className="mt-3 text-sm sm:text-base text-fg-muted max-w-xl leading-relaxed">
            متابعة الحصص الدراسية، تسجيل حضور الطلاب بالباركود الآمن، وتدقيق الواجبات والمدفوعات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/teacher/courses" className="btn-primary flex h-[var(--control-h-lg)] items-center justify-center gap-2 rounded-full px-7 font-bold text-sm transition-[filter] hover:brightness-105">
              <BookOpenIcon size={16} />
              إدارة المقررات
            </Link>
          <Link href="/teacher/students" className="flex h-[var(--control-h-lg)] items-center justify-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-7 font-semibold text-sm text-fg shadow-[var(--glass-highlight)] hover:bg-surface-raised transition-colors">
              <UsersIcon size={16} />
              سجل الطلاب
            </Link>
        </div>
      </div>
    </div>
  );
};

