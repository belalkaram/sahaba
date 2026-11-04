'use client';

import { StaffReportsPage } from '../../../features/reports/staff-reports-page';

export default function TeacherReportsPage() {
  return <StaffReportsPage home={{ label: 'لوحة التحكم', href: '/teacher/dashboard' }} />;
}
