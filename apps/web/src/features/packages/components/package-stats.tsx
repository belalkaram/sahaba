'use client';

import React from 'react';
import { StatCard } from '../../../components/ui/stat-card';

import { Banknote, Check, Folder, Package } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
export interface PackageStatsProps {
  total: number;
  active: number;
  archived: number;
  avgPrice: number;
}

export const PackageStats: React.FC<PackageStatsProps> = ({
  total,
  active,
  archived,
  avgPrice,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="إجمالي الباقات"
        value={total}
        subtitle="كافة خطط الاشتراك المسجلة"
        icon={<Package size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="باقات نشطة"
        value={active}
        subtitle="متاحة لاشتراك الطلاب فوراً"
        icon={<Check size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="باقات مؤرشفة"
        value={archived}
        subtitle="خطط اشتراك موقوفة أو قديمة"
        icon={<Folder size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="متوسط الأسعار"
        value={`${formatCurrency(avgPrice)}`}
        subtitle="متوسط أسعار الباقات النشطة"
        icon={<Banknote size={20} strokeWidth={1.75} aria-hidden />}
      />
    </div>
  );
};

