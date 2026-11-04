'use client';

import React from 'react';
import { StatCard } from '../../../components/ui/stat-card';
import { CredentialItem } from '../../../lib/credentials-api';

import { Ban, KeyRound, Smartphone, Users } from 'lucide-react';
export interface CredentialsStatsProps {
  credentials: CredentialItem[];
  totalStudents: number;
}

export const CredentialsStats: React.FC<CredentialsStatsProps> = ({
  credentials,
  totalStudents,
}) => {
  const activeCount = credentials.filter((c) => c.status === 'active').length;
  const boundCount = credentials.filter((c) => c.status === 'active' && Boolean(c.device_binding)).length;
  const revokedCount = credentials.filter((c) => c.status === 'revoked').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="إجمالي الطلاب المسجلين"
        value={totalStudents}
        subtitle="حسابات الطلاب في المؤسسة"
        icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="الأكواد النشطة"
        value={activeCount}
        subtitle="تراخيص صالحة لتسجيل الدخول"
        icon={<KeyRound size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="أجهزة مقترنة"
        value={boundCount}
        subtitle="أجهزة موثقة ببصمة رقمية"
        icon={<Smartphone size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="أكواد معطلة"
        value={revokedCount}
        subtitle="تم إلغاؤها أو استبدالها"
        icon={<Ban size={20} strokeWidth={1.75} aria-hidden />}
      />
    </div>
  );
};

