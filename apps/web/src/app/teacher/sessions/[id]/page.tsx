'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TeacherSessionRedirect() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  useEffect(() => {
    if (sessionId) {
      router.replace(`/staff/sessions/${sessionId}`);
    }
  }, [sessionId, router]);

  return (
    <div className="p-8 text-center text-fg-muted text-sm font-medium">
      جاري التحويل إلى مساحة عمل الحصة الموحدة...
    </div>
  );
}
