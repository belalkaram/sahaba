'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonClasses } from './button';
import { IconBack } from '../icons/directional';

export interface ForbiddenProps {
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

export const Forbidden: React.FC<ForbiddenProps> = ({
  title = 'غير مصرح بالدخول',
  description = 'ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة.',
  homeHref = '/',
  homeLabel = 'العودة للرئيسية',
  className = '',
}) => (
  <div className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center', className)}>
    <div className="arch relative grid h-20 w-16 place-items-center overflow-hidden bg-danger-subtle text-danger">
      <span className="pattern-overlay" aria-hidden />
      <ShieldX size={28} strokeWidth={1.75} className="relative" aria-hidden />
    </div>
    <div className="max-w-md space-y-1.5">
      <h2 className="text-xl font-bold text-fg">{title}</h2>
      <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
    </div>
    <Link href={homeHref} className={buttonClasses('secondary', 'md')}>
      <IconBack size={16} />
      {homeLabel}
    </Link>
  </div>
);
