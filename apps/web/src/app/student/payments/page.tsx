'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { billingApi, PaymentRequestItem } from '../../../lib/billing-api';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { StatCard } from '../../../components/ui/stat-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { Drawer } from '../../../components/ui/drawer';
import { PageHeader } from '../../../components/ui/page-header';
import { FileTextIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '../../../components/icons';

import { formatDateTime } from '../../../lib/format';
export default function StudentPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequestItem | null>(null);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await billingApi.getPaymentRequests();
      setPayments(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((p) => p.status === 'pending').length;
    const approved = payments.filter((p) => p.status === 'approved').length;
    const rejected = payments.filter((p) => p.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [payments]);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'instapay':
        return 'InstaPay';
      case 'bank_transfer':
        return 'تحويل بنكي';
      case 'cash':
        return 'نقداً بالسنتر';
      default:
        return method;
    }
  };

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">معتمد ومفعّل</Badge>;
      case 'rejected':
        return <Badge variant="danger">مرفوض</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">قيد المراجعة</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 text-start">
      {/* Header */}
      <PageHeader
        title="سجل طلبات السداد والتحويلات"
        subtitle="تابع حالة إيصالات التحويل البنكي وتأكيد الاشتراكات الخاصة بك في المنصة."
        actions={
          <Link href="/student/plans">
            <Button variant="primary" size="sm">
              طلب اشتراك جديد
            </Button>
          </Link>
        }
      />

      {/* High-level stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الطلبات"
          value={stats.total}
          icon={<FileTextIcon size={18} />}
          variant="default"
        />
        <StatCard
          title="قيد التدقيق"
          value={stats.pending}
          icon={<ClockIcon size={18} />}
          variant={stats.pending > 0 ? 'amber' : 'default'}
        />
        <StatCard
          title="الطلبات المعتمدة"
          value={stats.approved}
          icon={<CheckCircleIcon size={18} />}
          variant="emerald"
        />
        <StatCard
          title="المرفوضة"
          value={stats.rejected}
          icon={<XCircleIcon size={18} />}
          variant={stats.rejected > 0 ? 'amber' : 'default'}
        />
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden bg-surface border border-border shadow-xs">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={4} cols={5} />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="لم تقم بإرسال أي طلبات دفع حتى الآن"
              description="اختر باقة تعليمية مناسبة وقدم إيصال السداد للاستمتاع بجميع ميزات المنصة."
              action={{
                label: 'استعراض الباقات والاشتراك',
                onClick: () => {
                  window.location.href = '/student/plans';
                },
              }}
            />
          </div>
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-surface-raised border-b border-border text-fg-muted">
                <tr>
                  <th className="py-3 px-4 font-semibold">رقم المعاملة / التاريخ</th>
                  <th className="py-3 px-4 font-semibold">الباقة</th>
                  <th className="py-3 px-4 font-semibold">وسيلة السداد</th>
                  <th className="py-3 px-4 font-semibold">المبلغ</th>
                  <th className="py-3 px-4 font-semibold">الحالة</th>
                  <th className="py-3 px-4 font-semibold text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-raised/60 transition-colors group cursor-pointer"
                    onClick={() => setSelectedPayment(p)}
                  >
                    {/* ID & Date */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs text-primary font-semibold">
                        #{p.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-fg-muted mt-0.5">
                        {p.submitted_at
                          ? formatDateTime(p.submitted_at)
                          : 'منذ قليل'}
                      </div>
                    </td>

                    {/* Package */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-fg">
                        {p.package?.name || 'باقة اشتراك'}
                      </div>
                      {p.package?.code && (
                        <div className="text-xs text-fg-muted font-mono">
                          كود: {p.package.code}
                        </div>
                      )}
                    </td>

                    {/* Method & Ref */}
                    <td className="py-3.5 px-4">
                      <div className="text-fg-muted">{getMethodLabel(p.payment_method)}</div>
                      {p.reference_code && (
                        <div className="text-xs text-fg-muted font-mono mt-0.5">
                          مرجع: {p.reference_code}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-sm text-primary font-mono">
                        {p.amount} {p.currency || 'EGP'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPayment(p);
                        }}
                      >
                        معاينة التفاصيل
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Details Drawer */}
      <Drawer
        isOpen={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        title="تفاصيل طلب السداد"
        subtitle={selectedPayment ? `معاملة #${selectedPayment.id.slice(0, 8)}` : ''}
        width="md"
      >
        {selectedPayment && (
          <div className="space-y-6 text-xs text-start">
            {/* Status box */}
            <div className="p-4 rounded-md border border-border bg-surface-raised flex items-center justify-between">
              <div>
                <div className="text-fg-muted">حالة الطلب:</div>
                <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
              </div>
              <div className="text-end font-mono">
                <div className="text-fg-muted">المبلغ:</div>
                <div className="text-lg font-bold text-primary mt-0.5">
                  {selectedPayment.amount} {selectedPayment.currency || 'EGP'}
                </div>
              </div>
            </div>

            {/* Rejection reason alert */}
            {selectedPayment.status === 'rejected' && selectedPayment.rejection_reason && (
              <div className="p-4 rounded-md border border-danger/30 bg-danger-subtle text-danger space-y-1">
                <div className="font-bold">سبب الرفض المسجل من الإدارة المالية:</div>
                <div>{selectedPayment.rejection_reason}</div>
                <div className="mt-2 text-xs text-fg-muted">
                  يمكنك معالجة الخطأ المذكور وتقديم طلب سداد جديد بالبيانات المصححة.
                </div>
              </div>
            )}

            {/* Approved note */}
            {selectedPayment.status === 'approved' && (
              <div className="p-4 rounded-md border border-success/30 bg-success-subtle text-success space-y-1">
                <div className="font-bold">تم اعتماد الدفع وتفعيل الباقة!</div>
                <div>
                  يمكنك الآن الوصول لكافة المقررات والدروس المشمولة في باقة {selectedPayment.package?.name}.
                </div>
                <div className="mt-3">
                  <Link href="/student/courses">
                    <Button variant="primary" size="sm">
                      الانتقال إلى موادي الدراسية
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Summary details */}
            <div className="p-4 rounded-md border border-border bg-surface space-y-3">
              <div className="flex justify-between">
                <span className="text-fg-muted">الباقة:</span>
                <span className="text-fg font-semibold">
                  {selectedPayment.package?.name || 'باقة اشتراك'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">وسيلة الدفع:</span>
                <span className="text-fg font-medium">
                  {getMethodLabel(selectedPayment.payment_method)}
                </span>
              </div>
              {selectedPayment.reference_code && (
                <div className="flex justify-between">
                  <span className="text-fg-muted">الرقم المرجعي:</span>
                  <span className="text-fg font-mono">{selectedPayment.reference_code}</span>
                </div>
              )}
              {selectedPayment.sender_phone && (
                <div className="flex justify-between">
                  <span className="text-fg-muted">رقم المحول:</span>
                  <span className="text-fg font-mono">{selectedPayment.sender_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-fg-muted">تاريخ التقديم:</span>
                <span className="text-fg">
                  {selectedPayment.submitted_at
                    ? formatDateTime(selectedPayment.submitted_at)
                    : 'منذ قليل'}
                </span>
              </div>
            </div>

            {/* Proof preview */}
            <div className="p-4 rounded-md border border-border bg-surface space-y-3">
              <div className="font-semibold text-fg">مستند الإيصال المرفق:</div>
              {selectedPayment.proof_path ? (
                <div className="rounded-sm border border-border overflow-hidden bg-surface-raised p-2">
                  <img
                    src={billingApi.getPaymentProofUrl(selectedPayment.id)}
                    alt="إيصال السداد"
                    className="max-h-56 mx-auto object-contain rounded-xs"
                  />
                  <div className="mt-2 text-center">
                    <a
                      href={billingApi.getPaymentProofUrl(selectedPayment.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      فتح الإيصال في نافذة جديدة
                    </a>
                  </div>
                </div>
              ) : selectedPayment.proof_url ? (
                <div className="rounded-sm border border-border overflow-hidden bg-surface-raised p-2">
                  <img
                    src={selectedPayment.proof_url}
                    alt="إيصال السداد"
                    className="max-h-56 mx-auto object-contain rounded-xs"
                  />
                </div>
              ) : (
                <div className="text-fg-muted text-center py-4">
                  لم يتم إرفاق صورة ضوئية للإيصال (تم تسجيل الرقم المرجعي).
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
