'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import {
  CalendarIcon,
  BookOpenIcon,
  QrCodeIcon,
  FileTextIcon,
} from '../../../components/icons';

export const QuickActionsCard: React.FC = () => {
  const actions = [
    {
      title: 'تسجيل الحضور السريع',
      description: 'مسح باركود بطاقات الطلاب الديناميكي',
      href: '/teacher/attendance',
      icon: <QrCodeIcon size={20} className="text-primary" />,
    },
    {
      title: 'إضافة مقرر أو درس',
      description: 'رفع الفيديوهات وتنسيق المناهج',
      href: '/teacher/courses',
      icon: <BookOpenIcon size={20} className="text-info" />,
    },
    {
      title: 'جدول الحصص المباشرة',
      description: 'متابعة وتجهيز الفصول الافتراضية',
      href: '/teacher/meetings',
      icon: <CalendarIcon size={20} className="text-success" />,
    },
    {
      title: 'مراجعة الحوالات البنكية',
      description: 'اعتماد سداد الطلاب وتفعيل الاشتراكات',
      href: '/teacher/payments',
      icon: <FileTextIcon size={20} className="text-warning" />,
    },
  ];

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-bold text-fg pb-3 border-b border-border">
        روابط الوصول السريع
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((act) => (
          <Link
            key={act.href}
            href={act.href}
            className="p-3.5 rounded-md border border-border bg-surface-sunken hover:bg-surface-raised transition-colors flex items-start gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-surface border border-border">
              {act.icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-fg">{act.title}</h4>
              <p className="text-xs text-fg-muted mt-0.5">{act.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
};

