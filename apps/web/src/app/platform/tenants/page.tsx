'use client';

/**
 * R7A — Platform Multi-Tenants Management Page
 * Modularized into features/platform/components (< 200 lines).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import { FilterBar } from '../../../components/ui/filter-bar';
import { platformApi, type PlatformMetricsResponse } from '../../../lib/platform-api';
import type { Tenant } from '../../../types';
import { TenantStats } from '../../../features/platform/components/tenant-stats';
import { TenantTable } from '../../../features/platform/components/tenant-table';
import {
  CreateTenantModal,
  CreateTenantFormData,
} from '../../../features/platform/components/create-tenant-modal';
import { SupportAccessModal } from '../../../features/platform/components/support-access-modal';

import { partial } from '../../../lib/partial-failure';
const initialFormData: CreateTenantFormData = {
  name: '',
  slug: '',
  type: 'مدرسة خاصة / دولية',
  domain: '',
  adminEmail: '',
  adminPassword: '',
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetricsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [supportTenant, setSupportTenant] = useState<Tenant | null>(null);
  const [supportReason, setSupportReason] = useState('');
  const [isGeneratingSupport, setIsGeneratingSupport] = useState(false);

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateTenantFormData>(initialFormData);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantsData, metricsData] = await Promise.all([
        platformApi.getTenants(),
        platformApi.getMetrics().catch(partial(null)),
      ]);
      setTenants(tenantsData);
      setMetrics(metricsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug || !formData.adminEmail) return;

    setIsProvisioning(true);
    setProvisionError(null);

    try {
      const slug = formData.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
      const newTenant = await platformApi.provisionTenant({
        name: formData.name,
        slug,
        type: formData.type,
        owner: {
          name: `${formData.name} Admin`,
          email: formData.adminEmail,
          password: formData.adminPassword || 'password123',
        },
      });

      setIsProvisioning(false);
      setProvisionSuccess(true);
      setTenants((prev) => [newTenant, ...prev]);
    } catch (err: unknown) {
      setIsProvisioning(false);
      const message =
        err instanceof Error
          ? err.message
          : 'فشل في تهيئة المؤسسة. تحقق من الصلاحيات والبيانات وأعد المحاولة.';
      setProvisionError(message);
    }
  };

  const handleCreateSupportSession = async () => {
    if (!supportTenant || !supportReason.trim()) return;
    setIsGeneratingSupport(true);
    try {
      const session = await platformApi.generateSupportCode(supportTenant.id, supportReason.trim());
      setSupportTenant(null);
      setSupportReason('');
      window.open(`/login?support_code=${session.support_code}&tenant=${session.tenant}`, '_blank', 'noopener');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل بدء جلسة الدعم الفني.');
    } finally {
      setIsGeneratingSupport(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const isCurrentlyActive = currentStatus === 'active';
    try {
      if (isCurrentlyActive) {
        await platformApi.suspendTenant(tenantId);
      } else {
        await platformApi.activateTenant(tenantId);
      }
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, status: isCurrentlyActive ? 'suspended' : 'active' } : t))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل في تعديل حالة المؤسسة');
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.type && t.type.toLowerCase().includes(q))
      );
    });
  }, [tenants, searchQuery]);

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="إدارة المؤسسات التعليمية (Tenants)"
        description="لوحة تحكم المنصة المركزية لتهيئة وإدارة المستأجرين، الصلاحيات، ومتابعة الاستهلاك."
        breadcrumbs={[
          { label: 'لوحة المنصة', href: '/platform/dashboard' },
          { label: 'المؤسسات التعليمية' },
        ]}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setFormData(initialFormData);
              setProvisionSuccess(false);
              setProvisionError(null);
              setIsModalOpen(true);
            }}
          >
            تهيئة مؤسسة جديدة
          </Button>
        }
      />

      <TenantStats tenants={tenants} metrics={metrics} />

      <Card className="p-4 space-y-4">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="بحث بالاسم أو المعرف أو النطاق..."
        />

        <TenantTable
          tenants={filteredTenants}
          onToggleStatus={toggleTenantStatus}
          onCopyLoginUrl={(slug) => {
            navigator.clipboard?.writeText(`http://${slug}.localhost:3000/login`);
            alert(`تم نسخ رابط تسجيل دخول المستأجر (${slug})`);
          }}
          onOpenSupportModal={setSupportTenant}
          onOpenCreateModal={() => setIsModalOpen(true)}
        />
      </Card>

      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleStartProvisioning}
        formData={formData}
        onFormChange={setFormData}
        isProvisioning={isProvisioning}
        provisionSuccess={provisionSuccess}
        provisionError={provisionError}
      />

      <SupportAccessModal
        tenant={supportTenant}
        isOpen={Boolean(supportTenant)}
        onClose={() => setSupportTenant(null)}
        reason={supportReason}
        onReasonChange={setSupportReason}
        onConfirm={handleCreateSupportSession}
        isLoading={isGeneratingSupport}
      />
    </div>
  );
}
