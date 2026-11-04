'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { Skeleton } from '../../components/ui/skeleton';
import { ErrorState } from '../../components/ui/error-state';
import { educationApi } from '../../lib/education-api';
import { attendanceApi } from '../../lib/attendance-api';
import { useCan } from '../../hooks/useCan';
import { ReportsView, type ReportTypeOption } from './reports-view';

/** Reports for staff and tenant admins; choices are loaded from what the user may access. */
export function StaffReportsPage({ home }: { home: { label: string; href: string } }) {
  const [types, setTypes] = useState<ReportTypeOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const canSeePayments = useCan('payments.view');

  useEffect(() => {
    let cancelled = false;
    Promise.all([educationApi.getStudents(), educationApi.getCourses(), attendanceApi.getClasses()])
      .then(([students, courses, classes]) => {
        if (cancelled) return;
        const options: ReportTypeOption[] = [
          {
            type: 'student',
            label: 'تقرير طالب',
            parameter: {
              key: 'student_id',
              label: 'الطالب',
              options: students.map((s) => ({ value: s.id, label: s.user?.name ?? s.student_code ?? s.id })),
            },
          },
          {
            type: 'class_attendance',
            label: 'حضور شعبة',
            parameter: { key: 'class_id', label: 'الشعبة', options: classes.map((c) => ({ value: c.id, label: c.name })) },
          },
          {
            type: 'course_progress',
            label: 'تقدّم مقرر',
            parameter: { key: 'course_id', label: 'المقرر', options: courses.map((c) => ({ value: c.id, label: c.title })) },
          },
        ];
        if (canSeePayments) options.push({ type: 'payments', label: 'تقرير المدفوعات' });
        setTypes(options);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeePayments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير"
        description="تقارير الطلاب والحضور والتقدّم والمدفوعات ضمن نطاق صلاحياتك."
        breadcrumbs={[{ label: home.label, href: home.href }, { label: 'التقارير' }]}
      />
      {failed ? <ErrorState /> : types ? <ReportsView types={types} /> : <Skeleton className="h-64 w-full" />}
    </div>
  );
}
