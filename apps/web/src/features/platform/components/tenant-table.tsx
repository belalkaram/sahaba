'use client';

import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import type { Tenant } from '../../../types';

import { Link, School, ShieldCheck } from 'lucide-react';
export interface TenantTableProps {
  tenants: Tenant[];
  onToggleStatus: (id: string, status: string) => void;
  onCopyLoginUrl: (slug: string) => void;
  onOpenSupportModal: (tenant: Tenant) => void;
  onOpenCreateModal: () => void;
}

export const TenantTable: React.FC<TenantTableProps> = ({
  tenants,
  onToggleStatus,
  onCopyLoginUrl,
  onOpenSupportModal,
  onOpenCreateModal,
}) => {
  if (tenants.length === 0) {
    return (
      <EmptyState
        title="لا توجد مؤسسات تعليمية مطابقة"
        description="لم يتم العثور على أي مدرسة أو مركز يطابق معايير البحث."
        action={{
          label: 'تهيئة مؤسسة جديدة',
          onClick: onOpenCreateModal,
        }}
        icon={<School size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  return (
    <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-start border-collapse text-xs">
        <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
          <tr>
            <th className="py-3 px-4">اسم المؤسسة</th>
            <th className="py-3 px-4">المعرف (Slug)</th>
            <th className="py-3 px-4">النوع</th>
            <th className="py-3 px-4">النطاق (Domain)</th>
            <th className="py-3 px-4">قاعدة البيانات المعزولة</th>
            <th className="py-3 px-4">الحالة</th>
            <th className="py-3 px-4 text-center">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tenants.map((t) => (
            <tr key={t.id} className="hover:bg-surface-raised transition-colors">
              <td className="py-3.5 px-4 font-semibold text-fg">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg"><School size={18} strokeWidth={1.75} aria-hidden /></span>
                  <div>
                    <span className="font-bold text-fg text-sm">{t.name}</span>
                    <div className="text-xs text-fg-muted font-mono">ID: {t.id.slice(0, 8)}...</div>
                  </div>
                </div>
              </td>
              <td className="py-3.5 px-4 font-mono text-primary font-bold">{t.slug}</td>
              <td className="py-3.5 px-4 text-fg-muted">{t.type || 'مدرسة'}</td>
              <td className="py-3.5 px-4 font-mono text-fg-muted" dir="ltr">
                {t.slug}.localhost
              </td>
              <td className="py-3.5 px-4 font-mono text-success text-xs" dir="ltr">
                tenant_{t.slug}.sqlite
              </td>
              <td className="py-3.5 px-4">
                {t.status === 'active' ? (
                  <Badge variant="success">نشط ومعزول</Badge>
                ) : (
                  <Badge variant="danger">موقوف مؤقتاً</Badge>
                )}
              </td>
              <td className="py-3.5 px-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Button
                    variant={t.status === 'active' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={() => onToggleStatus(t.id, t.status)}
                  >
                    {t.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopyLoginUrl(t.slug)}
                    title="نسخ رابط الدخول"
                  >
                    
 <Link size={16} strokeWidth={1.75} aria-hidden /> نسخ الرابط
 </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenSupportModal(t)}
                    title="جلسة دعم فني مؤقتة"
                  >
                    
 <ShieldCheck size={16} strokeWidth={1.75} aria-hidden /> دعم فني
 </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

