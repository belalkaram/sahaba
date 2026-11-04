'use client';

/**
 * R7A — Admin Packages & Pricing Management Page
 * Modularized into features/packages/components (< 200 lines).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { billingApi, PackageItem } from '../../../lib/billing-api';
import { educationApi } from '../../../lib/education-api';
import type { Course } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Tabs } from '../../../components/ui/tabs';
import { PageHeader } from '../../../components/ui/page-header';
import { FilterBar } from '../../../components/ui/filter-bar';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { PackageStats } from '../../../features/packages/components/package-stats';
import { PackageTable } from '../../../features/packages/components/package-table';
import {
  PackageFormModal,
  PackageFormData,
} from '../../../features/packages/components/package-form-modal';

import { X } from 'lucide-react';
const initialFormData: PackageFormData = {
  name: '',
  code: '',
  description: '',
  price: 0,
  currency: 'SAR',
  billing_cycle: 'monthly',
  entitlements: [],
};

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [archivingPackage, setArchivingPackage] = useState<PackageItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<PackageFormData>(initialFormData);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pkgs, crs] = await Promise.all([
        billingApi.getPackages('all'),
        educationApi.getCourses(),
      ]);
      setPackages(pkgs);
      setCourses(crs);
    } catch {
      setFeedback({ type: 'error', text: 'فشل في تحميل الباقات أو المقررات من الخادم.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = packages.length;
    const active = packages.filter((p) => p.status === 'active').length;
    const archived = packages.filter((p) => p.status === 'archived').length;
    const avgPrice = active > 0
      ? Math.round(
          packages
            .filter((p) => p.status === 'active')
            .reduce((sum, p) => sum + Number(p.price || 0), 0) / active
        )
      : 0;
    return { total, active, archived, avgPrice };
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const codeMatch = p.code ? p.code.toLowerCase().includes(q) : false;
        if (!nameMatch && !codeMatch) return false;
      }
      return true;
    });
  }, [packages, statusFilter, search]);

  const openCreateModal = () => {
    setFormData(initialFormData);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (pkg: PackageItem) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      code: pkg.code || '',
      description: pkg.description || '',
      price: Number(pkg.price || 0),
      currency: pkg.currency || 'SAR',
      billing_cycle: pkg.billing_cycle || 'monthly',
      entitlements: (pkg.entitlements || []).map((e) =>
        typeof e === 'string' ? e : e.entitlement_key
      ),
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingPackage) {
        await billingApi.updatePackage(editingPackage.id, formData);
        setFeedback({ type: 'success', text: `تم تحديث الباقة "${formData.name}" بنجاح.` });
        setEditingPackage(null);
      } else {
        await billingApi.createPackage(formData);
        setFeedback({ type: 'success', text: `تم إنشاء الباقة الجديدة "${formData.name}" بنجاح.` });
        setIsCreateModalOpen(false);
      }
      await loadData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء حفظ الباقة. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingPackage) return;
    setIsSubmitting(true);
    try {
      await billingApi.archivePackage(archivingPackage.id);
      setFeedback({ type: 'success', text: `تم أرشفة الباقة "${archivingPackage.name}" بنجاح.` });
      setArchivingPackage(null);
      await loadData();
    } catch {
      setFeedback({ type: 'error', text: 'فشل أرشفة الباقة.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="إدارة الباقات والاشتراكات"
        description="تحديد خطط الاشتراكات الشهرية والسنوية والترم الدراسي وربط الصلاحيات الأكاديمية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/admin/dashboard' },
          { label: 'الباقات والأسعار' },
        ]}
        actions={
          <Button variant="primary" onClick={openCreateModal}>
            إنشاء باقة جديدة
          </Button>
        }
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

      <PackageStats {...stats} />

      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            tabs={[
              { id: 'active', label: 'الباقات النشطة' },
              { id: 'all', label: 'جميع الباقات' },
              { id: 'archived', label: 'المؤرشفة' },
            ]}
            activeTab={statusFilter}
            onChange={(tab) => setStatusFilter(tab as any)}
          />

          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="بحث باسم الباقة أو الكود..."
          />
        </div>

        <PackageTable
          packages={filteredPackages}
          loading={loading}
          onEdit={openEditModal}
          onArchive={setArchivingPackage}
          onOpenCreate={openCreateModal}
        />
      </Card>

      <PackageFormModal
        isOpen={isCreateModalOpen || Boolean(editingPackage)}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPackage(null);
        }}
        onSubmit={handleCreateOrUpdate}
        formData={formData}
        onFormChange={setFormData}
        courses={courses}
        isLoading={isSubmitting}
        isEditing={Boolean(editingPackage)}
      />

      <ConfirmDialog
        isOpen={Boolean(archivingPackage)}
        onClose={() => setArchivingPackage(null)}
        onConfirm={handleArchive}
        title="تأكيد أرشفة الباقة"
        description={`هل أنت متأكد من رغبتك في أرشفة الباقة "${archivingPackage?.name}"؟ لن يتمكن الطلاب الجدد من الاشتراك فيها.`}
        confirmText="تأكيد الأرشفة"
        isLoading={isSubmitting}
      />
    </div>
  );
}
