'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { educationApi } from '../../../lib/education-api';
import { ReportsView, type ReportTarget } from '../../../features/reports/reports-view';

/** R8-5 — parents download reports for their own linked children (enforced by the backend). */
export default function ParentReportsPage() {
  const [children, setChildren] = useState<ReportTarget[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    educationApi
      .getMyChildren()
      .then((list) => setChildren(list.map((c) => ({ value: c.id, label: c.user?.name ?? c.student_code ?? c.id }))))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="تقارير الأبناء" description="اطلب تقريراً أكاديمياً لأحد أبنائك، ثم نزّله أو اطبعه." />
      {failed ? (
        <ErrorState />
      ) : children ? (
        <ReportsView types={[{ type: 'parent', label: 'التقرير الأكاديمي', parameter: { key: 'student_id', label: 'الابن', options: children } }]} />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </div>
  );
}
