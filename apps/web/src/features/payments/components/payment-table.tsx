'use client';

import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { PaymentRequestItem } from '../../../lib/billing-api';

import { CreditCard } from 'lucide-react';
import { formatDate } from '../../../lib/format';
export interface PaymentTableProps {
  payments: PaymentRequestItem[];
  loading: boolean;
  onInspect: (payment: PaymentRequestItem) => void;
  onApprove: (payment: PaymentRequestItem) => void;
  onReject: (payment: PaymentRequestItem) => void;
  getMethodLabel: (method: string) => string;
}

export const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  loading,
  onInspect,
  onApprove,
  onReject,
  getMethodLabel,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">معتمدة ومفعلة</Badge>;
      case 'rejected':
        return <Badge variant="danger">مرفوضة</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">قيد المراجعة</Badge>;
    }
  };

  if (loading) {
    return <SkeletonTable rows={5} cols={6} />;
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        title="لا توجد طلبات سداد مطابقة"
        description="لم يتم العثور على أي عمليات دفع تطابق معايير الفلترة الحالية."
        icon={<CreditCard size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  return (
    <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-start border-collapse text-xs">
        <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
          <tr>
            <th className="py-3 px-4">رقم المعاملة</th>
            <th className="py-3 px-4">الطالب</th>
            <th className="py-3 px-4">الباقة المطلوبة</th>
            <th className="py-3 px-4">طريقة الدفع</th>
            <th className="py-3 px-4">المبلغ</th>
            <th className="py-3 px-4">الحالة</th>
            <th className="py-3 px-4 text-center">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((p) => (
            <tr
              key={p.id}
              className="hover:bg-surface-raised transition-colors cursor-pointer"
              onClick={() => onInspect(p)}
            >
              <td className="py-3.5 px-4 font-mono font-medium text-fg">
                #{p.id.slice(0, 8)}
                <div className="text-xs text-fg-muted">
                  {p.submitted_at
                    ? formatDate(p.submitted_at)
                    : 'الآن'}
                </div>
              </td>
              <td className="py-3.5 px-4">
                <div className="font-semibold text-fg">
                  {p.student?.user?.name || 'طالب مسجل'}
                </div>
                <div className="text-xs text-fg-muted">
                  {p.student?.user?.email || p.sender_phone || 'بدون اتصال'}
                </div>
              </td>
              <td className="py-3.5 px-4">
                <div className="font-medium text-fg">{p.package?.name || 'باقة مخصصة'}</div>
                {p.package?.price && (
                  <div className="text-xs text-fg-muted">
                    سعر الباقة: {p.package.price} ر.س
                  </div>
                )}
              </td>
              <td className="py-3.5 px-4">
                <div className="text-fg font-medium">{getMethodLabel(p.payment_method)}</div>
                <div className="text-xs text-fg-muted font-mono mt-0.5">
                  {p.reference_code ? `مرجع: ${p.reference_code}` : 'بدون رقم مرجعي'}
                </div>
              </td>
              <td className="py-3.5 px-4">
                <span className="font-bold text-sm text-primary font-mono">
                  {p.amount} {p.currency || 'ر.س'}
                </span>
              </td>
              <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>
              <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => onInspect(p)}>
                    معاينة
                  </Button>
                  {p.status === 'pending' && (
                    <>
                      <Button variant="primary" size="sm" onClick={() => onApprove(p)}>
                        اعتماد
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => onReject(p)}>
                        رفض
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
