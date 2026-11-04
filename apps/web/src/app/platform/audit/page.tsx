'use client';

import React from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { AuditLogView, type AuditPage } from '../../../features/audit/audit-log-view';
import { platformApi } from '../../../lib/platform-api';

const loadAudit = (params: { action?: string; page: number; per_page: number }) => platformApi.getAuditLogs(params) as Promise<AuditPage>;

/** R7F — global audit log across the platform. */
export default function PlatformAuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="سجل التدقيق العام"
        description="الإجراءات الحساسة على مستوى المنصة وجميع المؤسسات."
        breadcrumbs={[{ label: 'نظرة عامة', href: '/platform/dashboard' }, { label: 'سجل التدقيق' }]}
      />
      <AuditLogView load={loadAudit} />
    </div>
  );
}
