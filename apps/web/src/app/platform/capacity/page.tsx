'use client';

import React, { useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { Tabs } from '../../../components/ui/tabs';
import { CapacityRequestsPanel } from '../../../features/platform/capacity/requests-panel';
import { CapacityTenantsPanel } from '../../../features/platform/capacity/tenants-panel';

/** ADR-006 (CAP-1): only the super admin raises an academy's seats (student = code), after a manual transfer. */
export default function PlatformCapacityPage() {
  const [tab, setTab] = useState<'requests' | 'tenants'>('requests');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="السعة وطلبات الزيادة"
        description="كل طالب = كود واحد على جهاز واحد. المؤسسات تطلب مقاعد إضافية بعد التحويل اليدوي، وأنت فقط من يوافق ويضيف."
      />
      <Tabs
        activeTab={tab}
        onChange={(t) => setTab(t as 'requests' | 'tenants')}
        tabs={[
          { id: 'requests', label: 'طلبات الزيادة' },
          { id: 'tenants', label: 'حدود المؤسسات' },
        ]}
      />
      {tab === 'requests' ? <CapacityRequestsPanel onChanged={() => setRefreshKey((k) => k + 1)} /> : <CapacityTenantsPanel refreshKey={refreshKey} />}
    </div>
  );
}
