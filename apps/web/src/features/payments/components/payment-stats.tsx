'use client';

import React from 'react';
import { StatCard } from '../../../components/ui/stat-card';
import { PaymentRequestItem } from '../../../lib/billing-api';

import { Banknote, Check, Hourglass, X } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
export interface PaymentStatsProps {
  payments: PaymentRequestItem[];
}

export const PaymentStats: React.FC<PaymentStatsProps> = ({ payments }) => {
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const approvedCount = payments.filter((p) => p.status === 'approved').length;
  const rejectedCount = payments.filter((p) => p.status === 'rejected').length;

  const totalCollected = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="بانتظار المراجعة"
        value={pendingCount}
        subtitle="معاملات تتطلب التحقق البنكي"
        icon={<Hourglass size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="معاملات معتمدة"
        value={approvedCount}
        subtitle="تم تفعيل اشتراكاتهم بنجاح"
        icon={<Check size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="معاملات مرفوضة"
        value={rejectedCount}
        subtitle="حوالات غير مطابقة أو مكررة"
        icon={<X size={20} strokeWidth={1.75} aria-hidden />}
      />
      <StatCard
        title="إجمالي التحصيلات"
        value={`${formatCurrency(totalCollected)}`}
        subtitle="صافي المبالغ المعتمدة"
        icon={<Banknote size={20} strokeWidth={1.75} aria-hidden />}
      />
    </div>
  );
};
