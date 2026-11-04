'use client';

import React from 'react';
import { StatCard } from '../../../components/ui/stat-card';
import type { Tenant } from '../../../types';
import type { PlatformMetricsResponse } from '../../../lib/platform-api';

import { BookOpen, Check, School, Users } from 'lucide-react';
export interface TenantStatsProps {
  tenants: Tenant[];
  metrics: PlatformMetricsResponse | null;
}

export const TenantStats: React.FC<TenantStatsProps> = ({ tenants, metrics }) => {
  const activeCount = tenants.filter((t) => t.status === 'active').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="إجمالي المؤسسات"
        value={tenants.length}
        subtitle="جميع المدارس والمراكز المسجلة"
        icon={<School size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="المؤسسات النشطة"
        value={activeCount}
        subtitle="مستأجرين في بيئة معزولة ونشطة"
        icon={<Check size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="إجمالي الطلبة"
        value={metrics?.summary?.total_students ?? 0}
        subtitle="عبر جميع المؤسسات المسجلة"
        icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="إجمالي المقررات"
        value={metrics?.summary?.total_courses ?? 0}
        subtitle="مناهج وفصول دراسية نشطة"
        icon={<BookOpen size={20} strokeWidth={1.75} aria-hidden />}
      />
    </div>
  );
};

