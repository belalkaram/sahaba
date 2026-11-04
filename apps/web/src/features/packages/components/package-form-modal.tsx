'use client';

import React from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import type { Course } from '../../../types';

import { Check } from 'lucide-react';
export interface PackageFormData {
  name: string;
  code: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  entitlements: string[];
}

export interface PackageFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  formData: PackageFormData;
  onFormChange: (data: PackageFormData) => void;
  courses: Course[];
  isLoading: boolean;
  isEditing?: boolean;
}

export const PackageFormModal: React.FC<PackageFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onFormChange,
  courses,
  isLoading,
  isEditing = false,
}) => {
  const toggleEntitlement = (ent: string) => {
    const list = formData.entitlements.includes(ent)
      ? formData.entitlements.filter((e) => e !== ent)
      : [...formData.entitlements, ent];
    onFormChange({ ...formData, entitlements: list });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title={isEditing ? 'تعديل باقة الاشتراك' : 'إنشاء باقة اشتراك جديدة'}
      subtitle="حدد مواصفات الباقة والسعر والصلاحيات الممنوحة للمشتركين."
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2 text-xs text-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="اسم الباقة *"
            required
            placeholder="مثال: الباقة الشهرية الشاملة"
            value={formData.name}
            onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
          />
          <Input
            label="كود الباقة (Code)"
            placeholder="مثال: PKG-MONTHLY-ALL"
            value={formData.code}
            onChange={(e) => onFormChange({ ...formData, code: e.target.value })}
          />
        </div>

        <Input
          label="الوصف"
          placeholder="وصف مختصر لمحتويات الباقة والفئات المستهدفة"
          value={formData.description}
          onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="السعر *"
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.price}
            onChange={(e) => onFormChange({ ...formData, price: Number(e.target.value) })}
          />
          <Select
            label="العملة"
            options={[
              { value: 'SAR', label: 'ريال سعودي (SAR)' },
              { value: 'EGP', label: 'جنيه مصري (EGP)' },
              { value: 'USD', label: 'دولار أمريكي (USD)' },
            ]}
            value={formData.currency}
            onChange={(e) => onFormChange({ ...formData, currency: e.target.value })}
          />
          <Select
            label="دورة الفوترة"
            options={[
              { value: 'monthly', label: 'شهرياً' },
              { value: 'term', label: 'ترم دراسي' },
              { value: 'yearly', label: 'سنوياً' },
              { value: 'one_time', label: 'دفعة واحدة' },
            ]}
            value={formData.billing_cycle}
            onChange={(e) => onFormChange({ ...formData, billing_cycle: e.target.value })}
          />
        </div>

        {/* Entitlements Selector */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-fg font-bold block uppercase tracking-wider">
            الصلاحيات المشمولة بالباقة (Entitlements):
          </label>
          <div className="p-3 rounded-md border border-border bg-surface-sunken space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleEntitlement('ONLINE_ACCESS')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  formData.entitlements.includes('ONLINE_ACCESS')
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border text-fg-muted hover:text-fg'
                }`}
              >
                ONLINE_ACCESS (الوصول لمنصة الأونلاين)
              </button>
              <button
                type="button"
                onClick={() => toggleEntitlement('all_courses')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  formData.entitlements.includes('all_courses')
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border text-fg-muted hover:text-fg'
                }`}
              >
                all_courses (الوصول لجميع المقررات)
              </button>
            </div>

            {courses.length > 0 && (
              <div className="pt-2 border-t border-border">
                <span className="text-fg-muted text-xs block mb-1.5">
                  أو اختر مقررات دراسية محددة لربطها بالباقة:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {courses.map((c) => {
                    const entKey = `course:${c.id}`;
                    const isSelected = formData.entitlements.includes(entKey);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleEntitlement(entKey)}
                        className={`text-right px-2.5 py-1.5 rounded-md border text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary-subtle text-primary font-medium'
                            : 'border-border bg-surface text-fg-muted hover:text-fg'
                        }`}
                      >
                        <span className="truncate">{c.title}</span>
                        {isSelected && <span className="text-primary ms-1"><Check size={16} strokeWidth={1.75} aria-hidden /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            {isEditing ? 'حفظ التعديلات' : 'تأكيد إنشاء الباقة'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

