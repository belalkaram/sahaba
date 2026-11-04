'use client';

import React from 'react';
import type { Student, ClassSession } from '../../../types';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';

import { CalendarDays, Users } from 'lucide-react';
export interface AttendanceRosterProps {
  students: Student[];
  session: ClassSession | null;
  onRecord: (
    sessionId: string,
    studentId: string,
    status: 'present' | 'absent' | 'late' | 'excused'
  ) => Promise<void>;
}

export const AttendanceRoster: React.FC<AttendanceRosterProps> = ({
  students,
  session,
  onRecord,
}) => {
  if (!session) {
    return (
      <EmptyState
        title="اختر جلسة لعرض كشف الحضور"
        description="يرجى اختيار إحدى الجلسات المجدولة لرصد الحضور والغياب للطلاب."
        icon={<CalendarDays size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  if (students.length === 0) {
    return (
      <EmptyState
        title="لا يوجد طلاب مسجلين"
        description="لم يتم تسجيل أي طلاب في هذا الفصل الدراسي بعد."
        icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  return (
    <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-start border-collapse text-xs">
        <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
          <tr>
            <th className="py-3 px-4">اسم الطالب</th>
            <th className="py-3 px-4">كود الطالب</th>
            <th className="py-3 px-4 text-center">رصد الحالة يدوياً</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.map((st) => (
            <tr key={st.id} className="hover:bg-surface-raised transition-colors">
              <td className="py-3 px-4 font-semibold text-fg">
                {st.user?.name || 'طالب مسجل'}
              </td>
              <td className="py-3 px-4 font-mono text-fg-muted">
                {st.student_code || st.user?.phone || '---'}
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onRecord(session.id, st.id, 'present')}
                  >
                    حاضر
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRecord(session.id, st.id, 'late')}
                  >
                    متأخر
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onRecord(session.id, st.id, 'absent')}
                  >
                    غائب
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

