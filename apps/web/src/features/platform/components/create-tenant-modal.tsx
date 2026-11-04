'use client';

import React from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';

import { Loader2, PartyPopper } from 'lucide-react';
export interface CreateTenantFormData {
  name: string;
  slug: string;
  type: string;
  domain: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  formData: CreateTenantFormData;
  onFormChange: (data: CreateTenantFormData) => void;
  isProvisioning: boolean;
  provisionSuccess: boolean;
  provisionError: string | null;
}

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onFormChange,
  isProvisioning,
  provisionSuccess,
  provisionError,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isProvisioning && onClose()}
      title="معالج تهيئة مؤسسة تعليمية جديدة (Tenant Provisioning)"
      subtitle="عزل تلقائي للمستأجر، تشغيل الهجرات، وإنشاء المستخدم الإداري الأول."
      size="lg"
    >
      <div className="py-2 text-xs text-start space-y-4">
        {provisionError && (
          <div className="p-3 rounded-md bg-danger-subtle text-danger border border-danger/20 font-medium">
            {provisionError}
          </div>
        )}

        {provisionSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="text-4xl"><PartyPopper size={32} strokeWidth={1.75} aria-hidden /></div>
            <h4 className="text-sm font-bold text-success">
              تمت تهيئة المستأجر بنجاح وبناء قاعدة البيانات الخاصة به!
            </h4>
            <p className="text-xs text-fg-muted">
              المؤسسة جاهزة الآن للعمل واستقبال المعلمين والطلاب على النطاق المخصص.
            </p>
            <Button variant="primary" onClick={onClose} className="w-full">
              إغلاق المعالج
            </Button>
          </div>
        ) : isProvisioning ? (
          <div className="text-center py-8 space-y-3">
            <div className="inline-block animate-spin text-3xl"><Loader2 size={32} strokeWidth={1.75} className="animate-spin" aria-hidden /></div>
            <h4 className="text-sm font-bold text-fg">جاري إنشاء قاعدة البيانات وتشغيل الهجرات...</h4>
            <p className="text-xs text-fg-muted">يرجى الانتظار، تستغرق العملية بضع ثوانٍ لضمان العزل التام.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="اسم المؤسسة التعليمية (بالعربية) *"
                required
                placeholder="مثال: مدارس القمة العالمية"
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              />
              <Input
                label="المعرف الفريد (Slug - English only) *"
                required
                placeholder="مثال: al-qimmah"
                value={formData.slug}
                onChange={(e) =>
                  onFormChange({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="نوع المؤسسة"
                options={[
                  { value: 'مدرسة خاصة / دولية', label: 'مدرسة خاصة / دولية' },
                  { value: 'أكاديمية تدريب مهني', label: 'أكاديمية تدريب مهني' },
                  { value: 'معهد لغات وعلوم', label: 'معهد لغات وعلوم' },
                  { value: 'مركز تعليمي / دروس تقوية', label: 'مركز تعليمي / دروس تقوية' },
                ]}
                value={formData.type}
                onChange={(e) => onFormChange({ ...formData, type: e.target.value })}
              />
              <Input
                label="النطاق المخصص"
                placeholder={formData.slug ? `${formData.slug}.localhost` : 'alqimmah.localhost'}
                value={formData.domain}
                onChange={(e) => onFormChange({ ...formData, domain: e.target.value })}
              />
            </div>

            <div className="p-4 rounded-md bg-surface-sunken border border-border space-y-3">
              <span className="text-xs font-bold text-primary block uppercase tracking-wider">
                بيانات حساب المدير التنفيذي الأول (Owner User)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="البريد الإلكتروني للإدارة *"
                  type="email"
                  required
                  placeholder="admin@institution.edu"
                  value={formData.adminEmail}
                  onChange={(e) => onFormChange({ ...formData, adminEmail: e.target.value })}
                />
                <Input
                  label="كلمة المرور المؤقتة"
                  type="password"
                  placeholder="password123"
                  value={formData.adminPassword}
                  onChange={(e) => onFormChange({ ...formData, adminPassword: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={onClose} disabled={isProvisioning}>
                إلغاء
              </Button>
              <Button variant="primary" type="submit" isLoading={isProvisioning}>
                بدء تهيئة المؤسسة
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

