'use client';

import React from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import type { Tenant } from '../../../types';

export interface SupportAccessModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const SupportAccessModal: React.FC<SupportAccessModalProps> = ({
  tenant,
  isOpen,
  onClose,
  reason,
  onReasonChange,
  onConfirm,
  isLoading,
}) => {
  if (!tenant) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="طلب جلسة دعم فني مؤقتة (Support Session)"
      subtitle={`الدخول للمستأجر: ${tenant.name} (${tenant.slug}) لحل المشاكل الفنية`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!reason.trim()}
          >
            بدء جلسة الدعم
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-xs text-start">
        <div className="p-3.5 rounded-md border border-warning/30 bg-warning-subtle text-warning-subtle-fg space-y-1">
          <h4 className="font-bold">تنبيه أمني صارم (AGENTS.md & Audit Log):</h4>
          <p className="leading-relaxed">
            جميع الإجراءات المتخذة أثناء جلسة الدعم مسجلة في سجل التدقيق الأمني (Audit Log). الجلسة صالحة لمدة 60 دقيقة فقط وتتطلب مبرراً واضحاً.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-fg mb-1.5">
            سبب طلب الدخول الفني (Audit Trail Reason) *
          </label>
          <textarea aria-label="سبب طلب الدخول الفني (Audit Trail Reason)"
            className="w-full h-24 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder="مثال: تصحيح كشف حضور الطالب بناءً على التذكرة #T-1024..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

