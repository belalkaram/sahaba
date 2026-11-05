'use client';

/**
 * Backward compatibility redirect (OD-8 / P6.1):
 * Redirects legacy /teacher/attendance/scan/[sessionId] to /staff/attendance/scan/[sessionId].
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TeacherAttendanceRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  useEffect(() => {
    if (sessionId) {
      router.replace(`/staff/attendance/scan/${sessionId}`);
    } else {
      router.replace('/staff/attendance/scan');
    }
  }, [sessionId, router]);

  return (
    <div className="p-8 text-center text-fg-muted text-sm">
      جاري التحويل إلى واجهة مسح الحضور...
    </div>
  );
}
