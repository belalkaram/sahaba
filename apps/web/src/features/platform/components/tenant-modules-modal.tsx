'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { Tenant } from '../../../types';
import { platformApi } from '../../../lib/platform-api';
import { Layers, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface TenantModulesModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedTenant: Tenant) => void;
}

const AVAILABLE_MODULES: { key: string; label: string; desc: string; service: 'online' | 'offline' | 'core' }[] = [
  { key: 'online', label: 'الخدمة الأونلاين (Online Service)', desc: 'تفعيل كامل لمنظومة التعليم الرقمي عن بُعد', service: 'online' },
  { key: 'courses', label: 'المقررات والدروس الرقمية', desc: 'إدارة المناهج والوحدات ودروس الفيديو', service: 'online' },
  { key: 'assessments', label: 'الاختبارات والواجبات الرقمية', desc: 'منشئ الاختبارات والتصحيح ورصد الدرجات', service: 'online' },
  { key: 'meetings', label: 'الفصول الافتراضية والاجتماعات', desc: 'حصص البث المباشر والاجتماعات عبر الفيديو', service: 'online' },
  { key: 'media', label: 'مكتبة الوسائط', desc: 'رفع وإدارة ملفات الوسائط والمستندات التعليمية', service: 'online' },

  { key: 'offline', label: 'الخدمة الأوفلاين (Offline Service)', desc: 'تفعيل منظومة السناتر والقاعات والحضور الميداني', service: 'offline' },
  { key: 'attendance', label: 'الحصص والحضور بالـQR', desc: 'جلسات الحضور ورصد البطاقات الرقمية بكاميرا الجوال', service: 'offline' },
  { key: 'credentials', label: 'أكواد الدخول وأجهزة الطلاب', desc: 'ربط أجهزة الطلاب وبطاقات الدخول المادية', service: 'offline' },

  { key: 'billing', label: 'الاشتراكات والمدفوعات', desc: 'الباقات ورسوم الاشتراكات وإيصالات التحويل', service: 'core' },
  { key: 'analytics', label: 'التقارير وتحليلات الأداء', desc: 'مؤشرات الأداء وتحليلات الطلاب والشُّعب', service: 'core' },
];

export const TenantModulesModal: React.FC<TenantModulesModalProps> = ({
  tenant,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upgrade state
  const [upgradeKind, setUpgradeKind] = useState('center');
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (tenant) {
      const active = (tenant.features || [])
        .filter((f) => f.enabled)
        .map((f) => f.feature_key);
      setSelectedModules(active.length > 0 ? active : ['courses', 'attendance', 'billing', 'assessments', 'offline', 'core']);
      setError(null);
      setSuccess(null);
    }
  }, [tenant]);

  if (!tenant) return null;

  const isIndividualTeacher = tenant.type === 'individual_teacher';

  const handleToggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleSaveModules = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await platformApi.updateModules(tenant.id, selectedModules);
      onUpdated(updated);
      setSuccess('تم تحديث الوحدات والخدمات للمستأجر بنجاح');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الوحدات.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertToOrganization = async () => {
    setIsUpgrading(true);
    setError(null);
    try {
      const updated = await platformApi.convertToOrganization(tenant.id, upgradeKind);
      onUpdated(updated);
      setSuccess('تمت ترقية المشترك إلى مؤسسة تعليمية بنجاح.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل ترقية المشترك.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`إدارة الخدمات والوحدات: ${tenant.name}`}
      subtitle={`المعرف: ${tenant.slug} — النمط: ${isIndividualTeacher ? 'معلم مستقل' : 'مؤسسة تعليمية'}`}
      size="lg"
    >
      <div className="space-y-6 text-start">
        {success && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Upgrade section if individual teacher */}
        {isIndividualTeacher && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <ArrowUpRight size={14} className="text-primary" />
                  ترقية إلى مؤسسة تعليمية كاملة (OD-23)
                </h4>
                <p className="text-[0.6875rem] text-secondary mt-0.5">
                  يتيح إضافة مديرين ومسؤولي فروع وتعيين أدوار إدارية متعددة دون فقد أي بيانات سابقة.
                </p>
              </div>
              <Badge variant="neutral">معلم مستقل</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <select
                aria-label="نوع المؤسسة للترقية"
                value={upgradeKind}
                onChange={(e) => setUpgradeKind(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-primary"
              >
                <option value="center">مركز تعليمي / سنتر (Center)</option>
                <option value="academy">أكاديمية تعليمية (Academy)</option>
                <option value="school">مدرسة (School)</option>
                <option value="institute">معهد (Institute)</option>
              </select>

              <Button
                size="sm"
                variant="primary"
                onClick={handleConvertToOrganization}
                isLoading={isUpgrading}
              >
                تنفيذ الترقية لمؤسسة
              </Button>
            </div>
          </div>
        )}

        {/* Modules selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Layers size={14} className="text-primary" />
              الوحدات والخدمات المفعّلة
            </h4>
            <span className="text-[0.6875rem] text-secondary">
              {selectedModules.length} وحدة مفعّلة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {AVAILABLE_MODULES.map((m) => {
              const checked = selectedModules.includes(m.key);
              return (
                <label
                  key={m.key}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                    checked
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-surface hover:bg-surface-raised'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleModule(m.key)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-fg block truncate">{m.label}</span>
                    <span className="text-[0.6875rem] text-secondary block mt-0.5">{m.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            إلغاء
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveModules} isLoading={isSaving}>
            حفظ التغييرات
          </Button>
        </div>
      </div>
    </Modal>
  );
};
