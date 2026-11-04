'use client';

import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { PackageItem } from '../../../lib/billing-api';
import { EditIcon, TrashIcon, ShieldIcon } from '../../../components/icons';

import { Package } from 'lucide-react';
export interface PackageTableProps {
  packages: PackageItem[];
  loading: boolean;
  onEdit: (pkg: PackageItem) => void;
  onArchive: (pkg: PackageItem) => void;
  onOpenCreate: () => void;
}

export const PackageTable: React.FC<PackageTableProps> = ({
  packages,
  loading,
  onEdit,
  onArchive,
  onOpenCreate,
}) => {
  if (loading) {
    return <SkeletonTable rows={4} cols={6} />;
  }

  if (packages.length === 0) {
    return (
      <EmptyState
        title="لا توجد باقات تطابق البحث"
        description="لم يتم العثور على أي خطة اشتراك مطابقة لمعايير الفلترة الحالية."
        action={{
          label: 'إنشاء باقة جديدة',
          onClick: onOpenCreate,
        }}
        icon={<Package size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  const getCycleLabel = (cycle?: string) => {
    switch (cycle) {
      case 'monthly': return 'شهرياً';
      case 'term': return 'ترم دراسي';
      case 'yearly': return 'سنوياً';
      case 'one_time': return 'دفعة واحدة';
      default: return cycle || 'مخصص';
    }
  };

  return (
    <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-start border-collapse text-xs">
        <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
          <tr>
            <th className="py-3 px-4">اسم الباقة وكودها</th>
            <th className="py-3 px-4">السعر ودورة الفوترة</th>
            <th className="py-3 px-4">الصلاحيات المشمولة (Entitlements)</th>
            <th className="py-3 px-4">المشتركون النشطون</th>
            <th className="py-3 px-4">الحالة</th>
            <th className="py-3 px-4 text-center">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {packages.map((pkg) => {
            const isActive = pkg.status === 'active';
            const entitlements = (pkg.entitlements || []).map((e) =>
              typeof e === 'string' ? e : e.entitlement_key
            );

            return (
              <tr key={pkg.id} className="hover:bg-surface-raised transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-fg text-sm">{pkg.name}</div>
                  <div className="text-xs text-fg-muted font-mono mt-0.5">
                    {pkg.code ? `كود: ${pkg.code}` : 'بدون كود'}
                  </div>
                  {pkg.description && (
                    <div className="text-xs text-fg-muted mt-1 max-w-xs truncate">
                      {pkg.description}
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4 font-mono">
                  <div className="font-bold text-sm text-primary">
                    {pkg.price} {pkg.currency || 'ر.س'}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {getCycleLabel(pkg.billing_cycle)}
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  {entitlements.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-sm">
                      {entitlements.slice(0, 3).map((ent, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-xs bg-primary-subtle text-primary-subtle-fg font-mono border border-primary/20"
                        >
                          <ShieldIcon size={10} />
                          <span>{ent}</span>
                        </span>
                      ))}
                      {entitlements.length > 3 && (
                        <span className="text-xs text-fg-muted px-1.5 py-0.5 rounded-xs bg-surface-raised border border-border">
                          +{entitlements.length - 3} أخرى
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-fg-subtle text-xs">بدون صلاحيات صريحة</span>
                  )}
                </td>

                <td className="py-3.5 px-4">
                  <span className="font-bold text-fg font-mono text-xs">
                    {(pkg as any).subscriptions_count ?? 0}
                  </span>
                  <span className="text-fg-muted text-xs ms-1">مشترك</span>
                </td>

                <td className="py-3.5 px-4">
                  <Badge variant={isActive ? 'success' : 'neutral'}>
                    {isActive ? 'نشطة' : 'مؤرشفة'}
                  </Badge>
                </td>

                <td className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(pkg)}>
                      <EditIcon size={14} />
                      <span>تعديل</span>
                    </Button>
                    {isActive && (
                      <Button variant="danger" size="sm" onClick={() => onArchive(pkg)}>
                        <TrashIcon size={14} />
                        <span>أرشفة</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
