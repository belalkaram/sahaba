'use client';

/**
 * R7A — Teacher Payments Management Page
 * Modularized into features/payments/components (< 180 lines).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { billingApi, PaymentRequestItem } from '../../../lib/billing-api';
import { Card } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { FilterBar } from '../../../components/ui/filter-bar';
import { Tabs } from '../../../components/ui/tabs';
import { Select } from '../../../components/ui/select';
import { PaymentStats } from '../../../features/payments/components/payment-stats';
import { PaymentTable } from '../../../features/payments/components/payment-table';
import { PaymentInspectionDrawer } from '../../../features/payments/components/payment-inspection-drawer';
import {
  PaymentApprovalModal,
  PaymentRejectionModal,
} from '../../../features/payments/components/payment-action-modals';

import { X } from 'lucide-react';
export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const [inspectingPayment, setInspectingPayment] = useState<PaymentRequestItem | null>(null);
  const [approvingPayment, setApprovingPayment] = useState<PaymentRequestItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPayments = async () => {
    try {
      const data = await billingApi.getPaymentRequests();
      setPayments(data);
    } catch {
      setFeedback({ type: 'error', text: 'فشل في تحميل طلبات الدفع من الخادم.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer': return 'تحويل بنكي يدوي';
      case 'card': return 'بطاقة بنكية مدى / فيزا';
      case 'apple_pay': return 'Apple Pay';
      case 'cash': return 'سداد نقدي مباشر';
      default: return method || 'أخرى';
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentName = p.student?.user?.name?.toLowerCase() || '';
        const refCode = p.reference_code?.toLowerCase() || '';
        const phone = p.sender_phone?.toLowerCase() || '';
        const pkgName = p.package?.name?.toLowerCase() || '';
        const id = p.id.toLowerCase();
        if (
          !studentName.includes(q) &&
          !refCode.includes(q) &&
          !phone.includes(q) &&
          !pkgName.includes(q) &&
          !id.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [payments, statusFilter, methodFilter, search]);

  const confirmApprove = async () => {
    if (!approvingPayment) return;
    setIsApproving(true);
    try {
      await billingApi.approvePayment(approvingPayment.id);
      setFeedback({ type: 'success', text: `تم اعتماد التحويل وتفعيل الباقة للطالب بنجاح.` });
      setApprovingPayment(null);
      if (inspectingPayment?.id === approvingPayment.id) setInspectingPayment(null);
      await loadPayments();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء اعتماد المعاملة. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsApproving(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectingPayment || !rejectionReason.trim()) return;
    setIsRejecting(true);
    try {
      await billingApi.rejectPayment(rejectingPayment.id, rejectionReason.trim());
      setFeedback({ type: 'success', text: 'تم رفض طلب السداد وتوثيق السبب للطالب.' });
      setRejectingPayment(null);
      if (inspectingPayment?.id === rejectingPayment.id) setInspectingPayment(null);
      await loadPayments();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء رفض المعاملة. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="مراجعة وتدقيق الاشتراكات والمدفوعات"
        description="إدارة ومطابقة الحوالات البنكية لترقية اشتراكات الطلاب ومنح الصلاحيات فورياً."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/teacher/dashboard' },
          { label: 'الاشتراكات والمدفوعات' },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-success-subtle text-success-subtle-fg border border-success/30'
              : 'bg-danger-subtle text-danger-subtle-fg border border-danger/30'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2" aria-label="إغلاق"><X size={16} strokeWidth={1.75} aria-hidden /></button>
        </div>
      )}

      <PaymentStats payments={payments} />

      <Card className="p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <Tabs
            tabs={[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: 'قيد المراجعة' },
              { id: 'approved', label: 'معتمدة' },
              { id: 'rejected', label: 'مرفوضة' },
            ]}
            activeTab={statusFilter}
            onChange={(tab) => setStatusFilter(tab as any)}
          />

          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="بحث باسم الطالب، الرقم المرجعي، الهاتف..."
            actions={
              <Select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'جميع طرق الدفع' },
                  { value: 'bank_transfer', label: 'تحويل بنكي' },
                  { value: 'card', label: 'بطاقة بنكية' },
                  { value: 'apple_pay', label: 'Apple Pay' },
                  { value: 'cash', label: 'نقدي' },
                ]}
              />
            }
          />
        </div>

        <PaymentTable
          payments={filteredPayments}
          loading={loading}
          onInspect={(p) => setInspectingPayment(p)}
          onApprove={(p) => setApprovingPayment(p)}
          onReject={(p) => {
            setRejectingPayment(p);
            setRejectionReason('');
          }}
          getMethodLabel={getMethodLabel}
        />
      </Card>

      <PaymentInspectionDrawer
        payment={inspectingPayment}
        isOpen={Boolean(inspectingPayment)}
        onClose={() => setInspectingPayment(null)}
        onApprove={(p) => setApprovingPayment(p)}
        onReject={(p) => {
          setRejectingPayment(p);
          setRejectionReason('');
        }}
        getMethodLabel={getMethodLabel}
      />

      <PaymentApprovalModal
        payment={approvingPayment}
        isOpen={Boolean(approvingPayment)}
        onClose={() => !isApproving && setApprovingPayment(null)}
        onConfirm={confirmApprove}
        isLoading={isApproving}
      />

      <PaymentRejectionModal
        payment={rejectingPayment}
        isOpen={Boolean(rejectingPayment)}
        onClose={() => !isRejecting && setRejectingPayment(null)}
        onConfirm={confirmReject}
        isLoading={isRejecting}
        rejectionReason={rejectionReason}
        onReasonChange={setRejectionReason}
      />
    </div>
  );
}
