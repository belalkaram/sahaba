'use client';

import { StaffReportsPage } from '../../../features/reports/staff-reports-page';

export default function AdminReportsPage() {
  return <StaffReportsPage home={{ label: 'لوحة المؤسسة', href: '/admin' }} />;
}
