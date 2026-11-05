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
import { ShieldCheck, X } from 'lucide-react';

export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const [inspectingPayment, setInspectingPayment] = useState<PaymentRequestItem | null>(null);
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

  return (
    <div className="space-y-6 text-start pb-12">
      <PageHeader
        title="متابعة سداد واشتراكات الطلاب"
        description="متابعة حالة الحوالات وسداد الطلاب لشهرهم الدراسي (قراءة ومتابعة فقط)."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/teacher/dashboard' },
          { label: 'الاشتراكات والمدفوعات' },
        ]}
      />

      {/* Centralized Review Information Banner (OD-27) */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <div className="font-bold text-fg">رقابة مركزية على الاشتراكات (OD-27)</div>
          <p className="text-fg-muted leading-relaxed">
            يتم فحص إيصالات التحويل البنكي وتأكيد سداد الطلاب واعتماد اشتراكاتهم الشهرية عبر إدارة المنصة المركزية.
            تُعرض هذه القائمة للمعلم لمتابعة حالة سداد طلابه المسجلين للقراءة فقط.
          </p>
        </div>
      </div>

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
          getMethodLabel={getMethodLabel}
          readOnly={true}
        />
      </Card>

      <PaymentInspectionDrawer
        payment={inspectingPayment}
        isOpen={Boolean(inspectingPayment)}
        onClose={() => setInspectingPayment(null)}
        getMethodLabel={getMethodLabel}
        readOnly={true}
      />
    </div>
  );
}
