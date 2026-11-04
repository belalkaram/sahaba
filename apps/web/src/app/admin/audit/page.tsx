'use client';

import React from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { AuditLogView, type AuditPage } from '../../../features/audit/audit-log-view';
import { apiClient } from '../../../lib/api-client';

async function loadAudit(params: { action?: string; page: number; per_page: number }): Promise<AuditPage> {
  const res = await apiClient.get<AuditPage>('/audit-logs', { params });
  return res.data;
}

/** R7E — tenant audit log (backend enforces audit.view). */
export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="سجل التدقيق"
        description="كل الإجراءات الحساسة داخل مؤسستك: من نفّذها ومتى وعلى ماذا."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'سجل التدقيق' }]}
      />
      <AuditLogView load={loadAudit} />
    </div>
  );
}
