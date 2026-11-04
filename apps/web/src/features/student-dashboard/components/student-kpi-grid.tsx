'use client';

import React from 'react';
import { StatCard } from '../../../components/ui/stat-card';
import {
  CalendarIcon,
  BookOpenIcon,
  GraduationCapIcon,
  AwardIcon,
} from '../../../components/icons';
import type { StudentAnalyticsSnapshot } from '../../../types';

import { pctValue } from '../../../lib/format';
export interface StudentKpiGridProps {
  snapshot: StudentAnalyticsSnapshot | null;
}

export const StudentKpiGrid: React.FC<StudentKpiGridProps> = ({ snapshot }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="معدل الحضور التراكمي"
        value={pctValue(snapshot?.attendance_rate)}
        subtitle="مستمد من سجل الحضور"
        icon={<CalendarIcon size={20} />}
        variant="emerald"
      />
      <StatCard
        title="إنجاز الواجبات الدراسية"
        value={pctValue(snapshot?.assignment_completion_rate)}
        subtitle="نسبة تسليم الواجبات"
        icon={<BookOpenIcon size={20} />}
        variant="indigo"
      />
      <StatCard
        title="متوسط الاختبارات"
        value={pctValue(snapshot?.exam_average)}
        subtitle="أداء التقييمات الشاملة"
        icon={<GraduationCapIcon size={20} />}
        variant="default"
      />
      <StatCard
        title="المعدل العام المركب"
        value={pctValue(snapshot?.overall_score)}
        subtitle="الأداء الأكاديمي العام"
        icon={<AwardIcon size={20} />}
        variant="purple"
      />
    </div>
  );
};

