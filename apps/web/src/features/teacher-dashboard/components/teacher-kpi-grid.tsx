'use client';

import React from 'react';
import Link from 'next/link';
import { StatCard } from '../../../components/ui/stat-card';
import {
  UsersIcon,
  BookOpenIcon,
  FileTextIcon,
  CheckCircleIcon,
} from '../../../components/icons';

export interface TeacherKpiGridProps {
  studentsCount: number;
  coursesCount: number;
  pendingPaymentsCount: number;
  pendingGradingCount: number;
}

export const TeacherKpiGrid: React.FC<TeacherKpiGridProps> = ({
  studentsCount,
  coursesCount,
  pendingPaymentsCount,
  pendingGradingCount,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="إجمالي الطلاب"
        value={studentsCount}
        subtitle="مسجلين في المجموعات"
        icon={<UsersIcon size={20} />}
        variant="default"
      />
      <StatCard
        title="المقررات النشطة"
        value={coursesCount}
        subtitle="مقررات دراسية قيد التدريس"
        icon={<BookOpenIcon size={20} />}
        variant="indigo"
      />
      <StatCard
        title="طلبات دفع معلقة"
        value={pendingPaymentsCount}
        subtitle="حوالات تتطلب التحقق"
        icon={<FileTextIcon size={20} />}
        variant="amber"
        action={
          pendingPaymentsCount > 0 ? (
            <Link href="/teacher/payments" className="text-xs text-warning hover:underline font-bold">
              مراجعة
            </Link>
          ) : undefined
        }
      />
      <StatCard
        title="واجبات بحاجة للتصحيح"
        value={pendingGradingCount}
        subtitle="تسليمات الطلاب المعلقة"
        icon={<CheckCircleIcon size={20} />}
        variant="emerald"
        action={
          pendingGradingCount > 0 ? (
            <Link href="/teacher/grading" className="text-xs text-primary hover:underline font-bold">
              تصحيح
            </Link>
          ) : undefined
        }
      />
    </div>
  );
};

