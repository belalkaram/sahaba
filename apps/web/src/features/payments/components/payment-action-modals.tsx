'use client';

import React from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { PaymentRequestItem } from '../../../lib/billing-api';

const REJECTION_PRESETS = [
  'إيصال التحويل غير واضح أو غير مقروء',
  'المبلغ المحول غير مطابق لسعر الباقة المحددة',
  'الرقم المرجعي مكرر أو غير موجود بكشف الحساب البنكي',
  'اسم المحول غير متطابق مع بيانات الطالب المسجلة',
  'صورة الإيصال منتهية الصلاحية أو قديمة',
];

export interface PaymentApprovalModalProps {
  payment: PaymentRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const PaymentApprovalModal: React.FC<PaymentApprovalModalProps> = ({
  payment,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  if (!payment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تأكيد اعتماد التحويل وتفعيل الباقة"
      subtitle="سيتم ترقية حساب الطالب وتفعيل كافة الصلاحيات المرتبطة بالباقة فوراً."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={onConfirm} isLoading={isLoading}>
            تأكيد الاعتماد وتفعيل الباقة
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-sm text-fg-muted">
        <div className="p-3.5 rounded-sm border border-border bg-surface-raised space-y-2">
          <div className="flex justify-between">
            <span className="text-fg-muted">الطالب:</span>
            <span className="text-fg font-semibold">{payment.student?.user?.name || 'طالب مسجل'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">الباقة:</span>
            <span className="text-primary font-semibold">{payment.package?.name || 'باقة الاشتراك'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">المبلغ المدفوع:</span>
            <span className="text-success font-bold font-mono">
              {payment.amount} {payment.currency || 'ر.س'}
            </span>
          </div>
        </div>

        <p className="text-xs text-fg-muted leading-relaxed">
          وفقاً لقواعد النظام، عند الضغط على تأكيد:
          <br />
          1. سيتم تحديث حالة المعاملة إلى <strong className="text-success">معتمدة</strong>.
          <br />
          2. سيتم إنشاء سجل اشتراك نشط (Subscription) للطالب.
          <br />
          3. سيتم منح الصلاحيات (Entitlements) المحددة في الباقة تلقائياً دون أي تأخير.
        </p>
      </div>
    </Modal>
  );
};

export interface PaymentRejectionModalProps {
  payment: PaymentRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  rejectionReason: string;
  onReasonChange: (reason: string) => void;
}

export const PaymentRejectionModal: React.FC<PaymentRejectionModalProps> = ({
  payment,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  rejectionReason,
  onReasonChange,
}) => {
  if (!payment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="رفض طلب التحويل البنكي"
      subtitle="يرجى تحديد سبب الرفض بدقة لإشعار الطالب وتمكينه من تصحيح الإيصال."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!rejectionReason.trim()}
          >
            تأكيد رفض الطلب
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-start">
        <div>
          <label className="text-xs font-semibold text-fg block mb-2">
            أسباب الرفض الشائعة (اضغط للاختيار السريع):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REJECTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onReasonChange(preset)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                  rejectionReason === preset
                    ? 'border-primary bg-primary-subtle text-primary-subtle-fg font-medium'
                    : 'border-border bg-surface text-fg-muted hover:border-primary/50 hover:text-fg'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-fg block mb-1.5">
            نص سبب الرفض (يظهر للطالب):
          </label>
          <textarea aria-label="نص سبب الرفض (يظهر للطالب):"
            className="w-full h-24 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder="اكتب سبب رفض التحويل بالتفصيل..."
            value={rejectionReason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

